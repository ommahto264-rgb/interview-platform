import { randomUUID } from 'node:crypto';
import { pool } from '../../../../packages/database/client';
import type { TestCase } from '../../../../packages/execution/types';

export class SubmissionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function createSubmission(
  interviewId: string, userId: string, sourceCode: string, requestKey: string | null,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '10s'");
    // Serializes submissions and lifecycle changes for this interview.
    const interview = await client.query(
      `SELECT i.challenge_version_id
       FROM interviews i JOIN interview_candidates c ON c.interview_id = i.id
       WHERE i.id = $1 AND c.user_id = $2 FOR UPDATE OF i`, [interviewId, userId],
    );
    if (!interview.rows[0]) {
      throw new SubmissionError(409, 'Submission unavailable. You must be the candidate in an active interview.');
    }
    if (requestKey) {
      const previous = await client.query(
        `SELECT id, interview_id, source_code FROM submissions
         WHERE candidate_id = $1 AND request_key = $2`, [userId, requestKey],
      );
      if (previous.rows[0]) {
        const row = previous.rows[0];
        if (row.interview_id !== interviewId || row.source_code !== sourceCode) {
          throw new SubmissionError(409, 'This Idempotency-Key was used for a different submission.');
        }
        await client.query('COMMIT');
        return row.id as string;
      }
    }
    const current = interview.rows[0];
    const eligible = await client.query(
      `SELECT 1 FROM interviews WHERE id = $1 AND status = 'IN_PROGRESS'
       AND scheduled_start_at <= clock_timestamp() AND scheduled_end_at > clock_timestamp()`, [interviewId],
    );
    if (!eligible.rowCount) {
      throw new SubmissionError(409, 'Submission unavailable. You must be the candidate in an active interview.');
    }
    const pending = await client.query(
      `SELECT COUNT(*)::int AS count FROM submission_executions e
       JOIN submissions s ON s.id = e.submission_id
       WHERE s.interview_id = $1 AND e.status IN ('QUEUED', 'RUNNING')`, [interviewId],
    );
    if (pending.rows[0].count >= 3) {
      throw new SubmissionError(429, 'Three submissions are still waiting. Please wait for a result.');
    }
    const recent = await client.query(
      `SELECT 1 FROM submissions WHERE interview_id = $1
       AND submitted_at > NOW() - INTERVAL '2 seconds' LIMIT 1`, [interviewId],
    );
    if (recent.rowCount) throw new SubmissionError(429, 'Wait two seconds before submitting again.');

    const tests = await client.query<TestCase>(
      `SELECT position, input, expected_output, is_hidden FROM challenge_test_cases
       WHERE challenge_version_id = $1 ORDER BY position`, [current.challenge_version_id],
    );
    const snapshot = JSON.stringify(tests.rows);
    if (!tests.rowCount || tests.rowCount > 100 || Buffer.byteLength(snapshot) > 200_000) {
      throw new SubmissionError(422, 'The challenge test configuration needs to be corrected by an admin.');
    }
    const submissionId = randomUUID();
    await client.query(
      `INSERT INTO submissions(id, interview_id, candidate_id, source_code, request_key)
       VALUES ($1, $2, $3, $4, $5)`, [submissionId, interviewId, userId, sourceCode, requestKey],
    );
    await client.query(
      `INSERT INTO submission_executions
         (id, submission_id, challenge_version_id, source_code, test_cases, total_tests)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [randomUUID(), submissionId, current.challenge_version_id, sourceCode, snapshot, tests.rowCount],
    );
    await client.query('COMMIT');
    return submissionId;
  } catch (error) {
    await client.query('ROLLBACK');
    // A request key reused concurrently across interviews is also a conflict.
    if ((error as { code?: string }).code === '23505') {
      throw new SubmissionError(409, 'This submission request has already been used.');
    }
    throw error;
  } finally { client.release(); }
}
