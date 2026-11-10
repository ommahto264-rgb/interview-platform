import { randomUUID } from 'node:crypto';
import { pool } from '../database/client';
import type { ExecutionJob, ExecutionResult } from './types';

export async function claimJob(): Promise<ExecutionJob | undefined> {
  // Interrupted final attempts become terminal; earlier attempts can be reclaimed.
  await pool.query(`UPDATE submission_executions SET status = 'FAILED',
    error_code = 'WORKER_INTERRUPTED', finished_at = NOW(), lease_token = NULL, lease_expires_at = NULL
    WHERE status = 'RUNNING' AND lease_expires_at < NOW() AND attempts >= 3`);
  const result = await pool.query<ExecutionJob>(
    `WITH next_job AS (
       SELECT id FROM submission_executions
       WHERE attempts < 3 AND (
         (status = 'QUEUED' AND available_at <= NOW()) OR
         (status = 'RUNNING' AND lease_expires_at < NOW())
       ) ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE submission_executions e SET status = 'RUNNING', attempts = attempts + 1,
       lease_token = $1, lease_expires_at = NOW() + INTERVAL '60 seconds',
       started_at = COALESCE(started_at, NOW()), error_code = NULL
     FROM next_job WHERE e.id = next_job.id
     RETURNING e.id, e.lease_token, e.source_code, e.test_cases, e.attempts`, [randomUUID()],
  );
  return result.rows[0];
}

export async function renewLease(job: ExecutionJob) {
  const result = await pool.query(
    `UPDATE submission_executions SET lease_expires_at = NOW() + INTERVAL '60 seconds'
     WHERE id = $1 AND lease_token = $2 AND status = 'RUNNING' AND lease_expires_at > NOW()`,
    [job.id, job.lease_token],
  );
  return result.rowCount === 1;
}

export async function completeJob(job: ExecutionJob, result: ExecutionResult, imageId: string) {
  // Fencing: a worker whose lease expired cannot overwrite the new owner's result.
  const updated = await pool.query(
    `UPDATE submission_executions SET status = 'COMPLETED', verdict = $3,
       passed_tests = $4, results = $5::jsonb, finished_at = NOW(), runner_image = $6,
       lease_token = NULL, lease_expires_at = NULL
     WHERE id = $1 AND lease_token = $2 AND status = 'RUNNING' AND lease_expires_at > NOW()`,
    [job.id, job.lease_token, result.verdict, result.passed_tests, JSON.stringify(result.results), imageId],
  );
  return updated.rowCount === 1;
}

export async function retryJob(job: ExecutionJob, code: 'RUNNER_UNAVAILABLE' | 'WORKER_INTERRUPTED') {
  await pool.query(
    `UPDATE submission_executions SET
       status = CASE WHEN attempts >= 3 THEN 'FAILED' ELSE 'QUEUED' END,
       available_at = NOW() + INTERVAL '10 seconds', error_code = $3,
       finished_at = CASE WHEN attempts >= 3 THEN NOW() ELSE NULL END,
       lease_token = NULL, lease_expires_at = NULL
     WHERE id = $1 AND lease_token = $2 AND status = 'RUNNING' AND lease_expires_at > NOW()`,
    [job.id, job.lease_token, code],
  );
}

export async function leaseIsActive(id: string, token: string) {
  const result = await pool.query(
    `SELECT 1 FROM submission_executions WHERE id = $1 AND lease_token = $2
     AND status = 'RUNNING' AND lease_expires_at > NOW()`, [id, token],
  );
  return result.rowCount === 1;
}
