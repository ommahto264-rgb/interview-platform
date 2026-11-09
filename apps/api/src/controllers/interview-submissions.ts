import type { Request, Response } from "express";
import { pool } from "../../../../packages/database/client";

export async function listInterviewSubmissions(req: Request, res: Response) {
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

    res.setHeader("Cache-Control", "no-store");

    const interview = await pool.query(
      `SELECT id
       FROM interviews
       WHERE id = $1
         AND organization_id = $2
         AND ($3::text = 'ADMIN' OR interviewer_id = $4)`,
      [interviewId, organizationId, role, userId],
    );

    if (interview.rowCount === 0) {
      res.status(404).json({ error: "Interview not found." });
      return;
    }

    const result = await pool.query(
      `SELECT id, candidate_id, source_code, submitted_at
       FROM submissions
       WHERE interview_id = $1
       ORDER BY submitted_at DESC, id
       LIMIT 50`,
      [interviewId],
    );

    res.json({
      submissions: result.rows,
    });
}
