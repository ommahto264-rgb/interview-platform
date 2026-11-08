import { Router } from "express";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";

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