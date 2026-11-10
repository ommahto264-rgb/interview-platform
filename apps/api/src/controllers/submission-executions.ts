import type { Request, Response } from 'express';
import { pool } from '../../../../packages/database/client';
import type { CaseResult } from '../../../../packages/execution/types';
import { createSubmission, SubmissionError } from '../services/create-submission';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function submitCode(req: Request, res: Response) {
  const { interviewId } = req.params;
  const { sourceCode } = req.body ?? {};
  const requestKey = req.get('Idempotency-Key') ?? null;
  if (typeof interviewId !== 'string' || !uuid.test(interviewId)) {
    res.status(400).json({ error: 'Invalid interview ID.' }); return;
  }
  if (typeof sourceCode !== 'string' || !sourceCode.trim() || Buffer.byteLength(sourceCode) > 10240) {
    res.status(400).json({ error: 'Provide non-empty source code of at most 10 KiB.' }); return;
  }
  if (requestKey && !uuid.test(requestKey)) {
    res.status(400).json({ error: 'Idempotency-Key must be a UUID.' }); return;
  }
  try {
    const id = await createSubmission(interviewId, res.locals.auth.userId, sourceCode, requestKey);
    res.location(`/api/candidate/interviews/${interviewId}/submissions/${id}/execution`);
    res.status(201).json({ message: 'Code submitted successfully. Execution queued.' });
  } catch (error) {
    if (!(error instanceof SubmissionError)) throw error;
    if (error.status === 429) res.setHeader('Retry-After', '2');
    res.status(error.status).json({ error: error.message });
  }
}

// Explicit projection: never return the job snapshot, code, expected answers or logs.
const fields = `e.id, e.submission_id, e.status, e.verdict, e.passed_tests,
  e.total_tests, e.results, e.error_code, e.created_at, e.started_at, e.finished_at`;

export async function getSubmissionExecution(req: Request, res: Response) {
  const { interviewId, submissionId, organizationId } = req.params;
  if (typeof interviewId !== 'string' || !uuid.test(interviewId) ||
      typeof submissionId !== 'string' || !uuid.test(submissionId)) {
    res.status(400).json({ error: 'Valid interview and submission IDs are required.' }); return;
  }
  const staff = organizationId !== undefined;
  const result = staff
    ? await pool.query(
      `SELECT ${fields} FROM submission_executions e
       JOIN submissions s ON s.id = e.submission_id
       JOIN interviews i ON i.id = s.interview_id
       WHERE s.id = $1 AND i.id = $2 AND i.organization_id = $3
       AND ($4::text = 'ADMIN' OR i.interviewer_id = $5)`,
      [submissionId, interviewId, organizationId, res.locals.organizationRole, res.locals.auth.userId],
    )
    : await pool.query(
      `SELECT ${fields} FROM submission_executions e
       JOIN submissions s ON s.id = e.submission_id
       JOIN interview_candidates c ON c.interview_id = s.interview_id
       WHERE s.id = $1 AND s.interview_id = $2 AND s.candidate_id = $3 AND c.user_id = $3`,
      [submissionId, interviewId, res.locals.auth.userId],
    );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Submission execution not found.' }); return;
  }
  const execution = result.rows[0];
  execution.results = (execution.results as CaseResult[] | null)?.filter(
    (test) => staff || !test.is_hidden,
  ) ?? [];
  res.setHeader('Cache-Control', 'no-store');
  res.json({ execution });
}
