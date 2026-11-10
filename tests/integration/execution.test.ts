import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated database whose name ends in _test. Never use your project database.');
}
const schema = `execution_test_${randomUUID().replaceAll('-', '')}`;
process.env.DATABASE_URL = url;
process.env.JWT_SECRET = 'ab'.repeat(32);
process.env.PGOPTIONS = `-c search_path=${schema}`;
const admin = new pg.Pool({ connectionString: url });
const { pool } = await import('../../packages/database/client');
const { createSubmission } = await import('../../apps/api/src/services/create-submission');
const { claimJob, completeJob, renewLease, retryJob } = await import('../../packages/execution/queue');
const { createToken } = await import('../../apps/api/src/utils/jwt');
const { app } = await import('../../apps/api/src/app');

let server: Server;
let base: string;
const candidate = randomUUID(), outsider = randomUUID(), reviewer = randomUUID(), otherReviewer = randomUUID();
const organization = randomUUID(), otherOrganization = randomUUID(), challenge = randomUUID(), version = randomUUID();
const interview = randomUUID(), invitation = randomUUID();
const source = 'function solve(a,b) { return a+b; }';
let submission: string;

async function headers(user: string) {
  return { Cookie: `access_token=${await createToken(user)}`, 'Content-Type': 'application/json' };
}
async function ageSubmissions() {
  await pool.query("UPDATE submissions SET submitted_at = NOW() - INTERVAL '1 minute'");
}

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const file of (await readdir('packages/database/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = (await readFile(`packages/database/migrations/${file}`, 'utf8')).split('-- Down Migration')[0];
    await pool.query(sql);
  }
  for (const id of [candidate, outsider, reviewer, otherReviewer]) {
    await pool.query('INSERT INTO users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [id, 'Test', `${id}@example.com`, 'unused']);
  }
  for (const id of [organization, otherOrganization]) {
    await pool.query('INSERT INTO organizations(id,name,slug,created_by) VALUES ($1,$2,$3,$4)', [id, 'Test org', id, reviewer]);
  }
  for (const [user, org] of [[reviewer, organization], [otherReviewer, organization], [outsider, otherOrganization]]) {
    await pool.query("INSERT INTO organization_memberships(id,user_id,organization_id,role) VALUES ($1,$2,$3,'INTERVIEWER')", [randomUUID(), user, org]);
  }
  await pool.query('INSERT INTO challenges(id,organization_id,created_by) VALUES ($1,$2,$3)', [challenge, organization, reviewer]);
  await pool.query(`INSERT INTO challenge_versions(id,challenge_id,version_number,title,description,starter_code,created_by)
    VALUES ($1,$2,1,'Add','Sum two numbers','function solve(a,b) {}',$3)`, [version, challenge, reviewer]);
  for (const [position, hidden, input, output] of [[1, false, [2, 3], 5], [2, true, [-4, 10], 6]] as const) {
    await pool.query(`INSERT INTO challenge_test_cases(id,challenge_version_id,position,input,expected_output,is_hidden)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)`, [randomUUID(), version, position, JSON.stringify(input), JSON.stringify(output), hidden]);
  }
  await pool.query(`INSERT INTO interviews(id,organization_id,challenge_id,challenge_version_id,title,interviewer_id,created_by,
    scheduled_start_at,scheduled_end_at,status,started_at)
    VALUES ($1,$2,$3,$4,'Interview',$5,$5,NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour','IN_PROGRESS',NOW())`,
    [interview, organization, challenge, version, reviewer]);
  await pool.query(`INSERT INTO interview_invitations(id,interview_id,email,token_hash,invited_by,expires_at)
    VALUES ($1,$2,$3,$4,$5,NOW()+INTERVAL '1 hour')`, [invitation, interview, `${candidate}@example.com`, randomUUID(), reviewer]);
  await pool.query('INSERT INTO interview_candidates(interview_id,user_id,invitation_id) VALUES ($1,$2,$3)', [interview, candidate, invitation]);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

test('submission is atomic and duplicate request keys produce one job', async () => {
  const key = randomUUID();
  const ids = await Promise.all(Array.from({ length: 4 }, () => createSubmission(interview, candidate, source, key)));
  assert.equal(new Set(ids).size, 1);
  submission = ids[0];
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM submission_executions');
  assert.equal(count.rows[0].count, 1);
  await assert.rejects(createSubmission(interview, candidate, 'different code', key), { status: 409 });
});

test('unauthorized and inactive submissions cannot enqueue work', async () => {
  await assert.rejects(createSubmission(interview, outsider, source, null), { status: 409 });
  await pool.query("UPDATE interviews SET status = 'COMPLETED', completed_at=NOW() WHERE id=$1", [interview]);
  await assert.rejects(createSubmission(interview, candidate, source, null), { status: 409 });
  await pool.query("UPDATE interviews SET status = 'IN_PROGRESS', completed_at=NULL WHERE id=$1", [interview]);
});

test('schedule bounds are enforced even while status remains IN_PROGRESS', async () => {
  await pool.query("UPDATE interviews SET scheduled_start_at=NOW()+INTERVAL '10 minutes' WHERE id=$1", [interview]);
  await assert.rejects(createSubmission(interview, candidate, source, null), { status: 409 });
  await pool.query("UPDATE interviews SET scheduled_start_at=NOW()-INTERVAL '1 hour', scheduled_end_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [interview]);
  await assert.rejects(createSubmission(interview, candidate, source, null), { status: 409 });
  await pool.query("UPDATE interviews SET scheduled_end_at=NOW()+INTERVAL '1 hour' WHERE id=$1", [interview]);
});

test('queued tests are snapshots of the assigned version', async () => {
  await pool.query("UPDATE challenge_test_cases SET expected_output='999'::jsonb WHERE challenge_version_id=$1 AND position=2", [version]);
  const row = (await pool.query('SELECT test_cases FROM submission_executions WHERE submission_id=$1', [submission])).rows[0];
  assert.equal(row.test_cases[1].expected_output, 6);
  await pool.query("UPDATE challenge_test_cases SET expected_output='6'::jsonb WHERE challenge_version_id=$1 AND position=2", [version]);
});

test('queue insertion failure rolls back the submission' , async () => {
  await ageSubmissions();
  await pool.query(`CREATE FUNCTION fail_queue_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Test failure'; END $$;
    CREATE TRIGGER fail_queue BEFORE INSERT ON submission_executions FOR EACH ROW EXECUTE FUNCTION fail_queue_insert()`);
  try { await assert.rejects(createSubmission(interview, candidate, source, randomUUID())); }
  finally { await pool.query('DROP TRIGGER fail_queue ON submission_executions; DROP FUNCTION fail_queue_insert()'); }
  assert.equal((await pool.query('SELECT COUNT(*)::int AS count FROM submissions')).rows[0].count, 1);
});

test('concurrent workers claim a job only once; expired leases fence old results', async () => {
  const claimed = (await Promise.all([claimJob(), claimJob(), claimJob()])).filter((j) => !!j);
  assert.equal(claimed.length, 1);
  const old = claimed[0];
  assert.equal(await renewLease(old), true);
  await pool.query("UPDATE submission_executions SET lease_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [old.id]);
  const current = await claimJob();
  assert(current);
  assert.notEqual(current.lease_token, old.lease_token);
  const result = { verdict: 'ACCEPTED' as const, passed_tests: 2, results: [
    { position: 1, is_hidden: false, verdict: 'ACCEPTED' as const, duration_ms: 10 },
    { position: 2, is_hidden: true, verdict: 'ACCEPTED' as const, duration_ms: 10 },
  ] };
  assert.equal(await completeJob(old, result, 'test-image'), false);
  assert.equal(await renewLease(old), false);
  assert.equal(await completeJob(current, result, 'test-image'), true);
});

test('candidate sees only own execution and visible cases; staff must be assigned and in the right org', async () => {
  const route = `/api/candidate/interviews/${interview}/submissions/${submission}/execution`;
  assert.equal((await fetch(base + route)).status, 401);
  assert.equal((await fetch(base + route, { headers: await headers(outsider) })).status, 404);
  const response = await fetch(base + route, { headers: await headers(candidate) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.execution.passed_tests, 2);
  assert.equal(body.execution.results.length, 1);
  for (const secret of ['test_cases', 'expected_output', 'source_code', 'lease_token', 'runner_image']) {
    assert.equal(secret in body.execution, false);
  }
  const staffRoute = `/api/organizations/${organization}/interviews/${interview}/submissions/${submission}/execution`;
  assert.equal((await fetch(base + staffRoute, { headers: await headers(otherReviewer) })).status, 404);
  const staff = await fetch(base + staffRoute, { headers: await headers(reviewer) });
  assert.equal(staff.status, 200);
  assert.equal((await staff.json()).execution.results.length, 2);
  const crossTenant = staffRoute.replace(organization, otherOrganization);
  assert.equal((await fetch(base + crossTenant, { headers: await headers(outsider) })).status, 404);
});

test('API queues and returns a Location header with message-only body', async () => {
  await ageSubmissions();
  const response = await fetch(`${base}/api/candidate/interviews/${interview}/submissions`, {
    method: 'POST', headers: await headers(candidate), body: JSON.stringify({ sourceCode: source }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(Object.keys(await response.json()), ['message']);
  const location = response.headers.get('location');
  assert(location);
  const status = await fetch(base + location, { headers: await headers(candidate) });
  assert.equal((await status.json()).execution.status, 'QUEUED');
});

test('three infrastructure failures become terminal without a candidate verdict', async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const job = await claimJob();
    assert(job);
    assert.equal(job.attempts, attempt);
    await retryJob(job, 'RUNNER_UNAVAILABLE');
    await pool.query("UPDATE submission_executions SET available_at=NOW() WHERE status='QUEUED'");
  }
  const failed = await pool.query("SELECT * FROM submission_executions WHERE status='FAILED'");
  assert.equal(failed.rowCount, 1);
  assert.equal(failed.rows[0].verdict, null);
  assert.equal(await claimJob(), undefined);
});

test('in-flight limit holds under concurrent submissions', async () => {
  for (let i = 0; i < 3; i++) {
    await ageSubmissions();
    await createSubmission(interview, candidate, source, randomUUID());
  }
  await ageSubmissions();
  const attempts = await Promise.allSettled(Array.from({ length: 4 }, () => createSubmission(interview, candidate, source, randomUUID())));
  assert(attempts.every((r) => r.status === 'rejected' && r.reason.status === 429));
});

test('full pipeline: queued submissions are executed by the real Docker worker', {
  skip: process.env.RUN_DOCKER_E2E !== '1', timeout: 90_000,
}, async () => {
  const pendingIds = (await pool.query("SELECT id FROM submission_executions WHERE status='QUEUED'")).rows.map((row) => row.id);
  assert.equal(pendingIds.length, 3);
  const worker = spawn(process.execPath, ['--import', 'tsx', 'apps/worker/src/worker.ts'], {
    env: { ...process.env, WORKER_NAMESPACE: `e2e-${randomUUID().slice(0, 8)}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  worker.stdout.on('data', (chunk) => { output += chunk; });
  worker.stderr.on('data', (chunk) => { output += chunk; });
  const exited = new Promise<void>((resolve) => worker.once('exit', () => resolve()));
  try {
    const deadline = Date.now() + 70_000;
    while (Date.now() < deadline) {
      const rows = await pool.query("SELECT status, verdict, passed_tests, runner_image FROM submission_executions WHERE id = ANY($1::uuid[])", [pendingIds]);
      if (rows.rowCount === 3 && rows.rows.every((row) => row.status === 'COMPLETED')) {
        for (const row of rows.rows) {
          assert.equal(row.verdict, 'ACCEPTED');
          assert.equal(row.passed_tests, 2);
          assert.match(row.runner_image, /^sha256:/);
        }
        return;
      }
      if (worker.exitCode !== null) assert.fail(`Worker exited early: ${output}`);
      await delay(500);
    }
    assert.fail(`Worker did not complete queued submissions: ${output}`);
  } finally {
    worker.kill('SIGTERM');
    const force = setTimeout(() => worker.kill('SIGKILL'), 15_000);
    await exited;
    clearTimeout(force);
  }
});
