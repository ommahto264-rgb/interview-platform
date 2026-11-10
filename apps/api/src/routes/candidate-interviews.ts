import { Router } from "express";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";
import { submitCode, getSubmissionExecution } from "../controllers/submission-executions";

export const candidateInterviewRouter = Router();

candidateInterviewRouter.get("/", requireAuth, async (_req, res) => {
  const userId = res.locals.auth.userId;

  const result = await pool.query(
    `SELECT
       i.id,
       i.title,
       i.status,
       i.scheduled_start_at,
       i.scheduled_end_at,
       o.name AS organization_name
     FROM interview_candidates c
     JOIN interviews i ON i.id = c.interview_id
     JOIN organizations o ON o.id = i.organization_id
     WHERE c.user_id = $1
     ORDER BY i.scheduled_start_at DESC, i.id
     LIMIT 50`,
    [userId],
  );

  res.setHeader("Cache-Control", "no-store");

  res.json({
    interviews: result.rows,
  });
});

candidateInterviewRouter.get(
  "/:interviewId/challenge",
  requireAuth,
  async (req, res) => {
    const { interviewId } = req.params;
    const userId = res.locals.auth.userId;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof interviewId !== "string" ||
      !uuidPattern.test(interviewId)
    ) {
      res.status(400).json({ error: "Invalid interview ID." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");

    const result = await pool.query(
      `SELECT
         v.id AS version_id,
         v.title,
         v.description,
         v.language,
         v.starter_code
       FROM interviews i
       JOIN interview_candidates c ON c.interview_id = i.id
       JOIN challenge_versions v ON v.id = i.challenge_version_id
       WHERE i.id = $1
         AND c.user_id = $2
         AND i.status = 'IN_PROGRESS'
         AND i.scheduled_start_at <= NOW()
         AND i.scheduled_end_at > NOW()`,
      [interviewId, userId],
    );

    const challenge = result.rows[0];

    if (!challenge) {
      res.status(404).json({
        error: "Active interview challenge not available.",
      });
      return;
    }

    const examples = await pool.query(
      `SELECT position, input, expected_output
       FROM challenge_test_cases
       WHERE challenge_version_id = $1
         AND is_hidden = FALSE
       ORDER BY position`,
      [challenge.version_id],
    );

    res.json({
      challenge,
      examples: examples.rows,
    });
  },
);

candidateInterviewRouter.post('/:interviewId/submissions', requireAuth, submitCode);
candidateInterviewRouter.get(
  '/:interviewId/submissions/:submissionId/execution', requireAuth, getSubmissionExecution,
);

candidateInterviewRouter.get(
  "/:interviewId/submissions",
  requireAuth,
  async (req, res) => {
    const { interviewId } = req.params;
    const userId = res.locals.auth.userId;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof interviewId !== "string" ||
      !uuidPattern.test(interviewId)
    ) {
      res.status(400).json({ error: "Invalid interview ID." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");

    const candidate = await pool.query(
      `SELECT interview_id
       FROM interview_candidates
       WHERE interview_id = $1 AND user_id = $2`,
      [interviewId, userId],
    );

    if (candidate.rowCount === 0) {
      res.status(404).json({ error: "Interview not found." });
      return;
    }

    const result = await pool.query(
      `SELECT id, source_code, submitted_at
       FROM submissions
       WHERE interview_id = $1 AND candidate_id = $2
       ORDER BY submitted_at DESC, id
       LIMIT 50`,
      [interviewId, userId],
    );

    res.json({ submissions: result.rows });
  },
);