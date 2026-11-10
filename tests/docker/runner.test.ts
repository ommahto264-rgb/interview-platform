import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { ExecutionJob } from '../../packages/execution/types';

// No DB operations are used by these container tests.
process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.WORKER_NAMESPACE = `test-${randomUUID().slice(0, 8)}`;
const { getRunnerImage, runCase } = await import('../../apps/worker/src/docker');
let image: string;
before(async () => { image = await getRunnerImage(); });
function job(): ExecutionJob {
  return { id: randomUUID(), lease_token: randomUUID(), source_code: '', test_cases: [], attempts: 1 };
}
async function run(source: string, input: unknown[] = []) {
  return runCase(job(), image, source, input, 1, new AbortController().signal);
}

test('real container returns computed value, including Unicode', async () => {
  assert.equal((await run('function solve(a,b) { return a+b; }', [2, 3])).value, 5);
  assert.equal((await run('function solve() { return "हैलो 👋"; }')).value, 'हैलो 👋');
});

test('infinite loops are killed and containers removed', async () => {
  assert.equal((await run('function solve() { while(true) {} }')).verdict, 'TIME_LIMIT_EXCEEDED');
});

test('excessive output is bounded', async () => {
  assert.equal((await run('function solve() { while(true) console.log("x".repeat(10000)); }')).verdict, 'OUTPUT_LIMIT_EXCEEDED');
});

test('throws, syntax errors, missing solve and undefined returns are runtime errors', async () => {
  for (const source of ['function solve() { throw new Error(); }', 'function solve(', 'const x=1;', 'function solve() {}']) {
    assert.equal((await run(source)).verdict, 'RUNTIME_ERROR');
  }
});

test('filesystem is read-only and credentials are absent', async () => {
  const fs = await run('function solve() { try { require("fs").writeFileSync("/runner/file", "x"); return "writable"; } catch(e) { return e.code; } }');
  assert(['EROFS', 'EACCES'].includes(fs.value as string));
  const env = await run('function solve() { return {db: !!process.env.DATABASE_URL, jwt: !!process.env.JWT_SECRET}; }');
  assert.deepEqual(env.value, { db: false, jwt: false });
});

test('network namespace has only loopback', async () => {
  const result = await run('function solve() { return Object.keys(require("os").networkInterfaces()); }');
  assert.deepEqual(result.value, ['lo']);
});

test('abort removes container and no test containers remain', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await assert.rejects(runCase(job(), image, 'function solve() { while(true) {} }', [], 1, controller.signal));
  } finally { clearTimeout(timer); }
  const remaining = execFileSync('docker', ['ps', '-aq', '--filter', `label=interview-platform.namespace=${process.env.WORKER_NAMESPACE}`], { encoding: 'utf8' });
  assert.equal(remaining.trim(), '');
});
