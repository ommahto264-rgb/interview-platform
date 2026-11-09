import type { Request, Response } from "express";
import { pool } from "../../../../packages/database/client";

export async function startInterview(req: Request, res: Response) {
    const { organizationId, interviewId } = req.params;
    const userId = res.locals.auth.userId;
    const role = res.locals.organizationRole;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof interviewId !== "string" ||
      !uuidPattern.test(interviewId)
    ) {
      res.status(400).json({ error: "Invalid interview ID." });
      return;
    }

    const result = await pool.query(
      `UPDATE interviews i
       SET status = 'IN_PROGRESS',
           started_at = NOW(),
           updated_at = NOW()
       WHERE i.id = $1
         AND i.organization_id = $2
         AND ($3::text = 'ADMIN' OR i.interviewer_id = $4)
         AND i.status = 'SCHEDULED'
         AND i.scheduled_start_at <= NOW()
         AND i.scheduled_end_at > NOW()
         AND EXISTS (
           SELECT 1
           FROM interview_candidates c
           WHERE c.interview_id = i.id
         )
       RETURNING i.id`,
      [interviewId, organizationId, role, userId],
    );

    res.setHeader("Cache-Control", "no-store");

    if (result.rowCount === 0) {
      res.status(409).json({
        error: "Interview cannot be started. Check access, status, schedule, and candidate acceptance.",
      });
      return;
    }

    res.json({ message: "Interview started successfully." });
}

export async function completeInterview(req: Request, res: Response) {
    const { organizationId, interviewId } = req.params;
    const userId = res.locals.auth.userId;
    const role = res.locals.organizationRole;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof interviewId !== "string" ||
      !uuidPattern.test(interviewId)
    ) {
      res.status(400).json({ error: "Invalid interview ID." });
      return;
    }

    const result = await pool.query(
      `UPDATE interviews
       SET status = 'COMPLETED',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND organization_id = $2
         AND ($3::text = 'ADMIN' OR interviewer_id = $4)
         AND status = 'IN_PROGRESS'
       RETURNING id`,
      [interviewId, organizationId, role, userId],
    );

    res.setHeader("Cache-Control", "no-store");

    if (result.rowCount === 0) {
      res.status(409).json({
        error: "Interview cannot be completed. Check access and status.",
      });
      return;
    }

    res.json({
      message: "Interview completed successfully.",
    });
}
