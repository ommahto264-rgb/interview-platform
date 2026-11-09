import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";

export async function createInterviewEvaluation(req: Request, res: Response) {
    const { organizationId, interviewId } = req.params;
    const userId = res.locals.auth.userId;
    const role = res.locals.organizationRole;

    const {
      problemSolving,
      codeQuality,
      communication,
      recommendation,
      feedback,
    } = req.body ?? {};

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof interviewId !== "string" ||
      !uuidPattern.test(interviewId)
    ) {
      res.status(400).json({ error: "Invalid interview ID." });
      return;
    }

    const scores = [problemSolving, codeQuality, communication];

    for (const score of scores) {
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        res.status(400).json({
          error: "Each score must be a whole number from 1 to 5.",
        });
        return;
      }
    }

    const recommendations = ["STRONG_NO", "NO", "YES", "STRONG_YES"];

    if (!recommendations.includes(recommendation)) {
      res.status(400).json({
        error: "Recommendation must be STRONG_NO, NO, YES, or STRONG_YES.",
      });
      return;
    }

    if (
      typeof feedback !== "string" ||
      feedback.trim().length === 0 ||
      feedback.trim().length > 5000
    ) {
      res.status(400).json({
        error: "Feedback must contain between 1 and 5000 characters.",
      });
      return;
    }

    res.setHeader("Cache-Control", "no-store");

    const interview = await pool.query(
      `SELECT status FROM interviews
       WHERE id = $1
         AND organization_id = $2
         AND ($3::text = 'ADMIN' OR interviewer_id = $4)`,
      [interviewId, organizationId, role, userId],
    );

    if (interview.rowCount === 0) {
      res.status(404).json({ error: "Interview not found." });
      return;
    }

    if (interview.rows[0].status !== "COMPLETED") {
      res.status(409).json({
        error: "Complete the interview before submitting an evaluation.",
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO interview_evaluations (
         id, interview_id, reviewer_id,
         problem_solving_score, code_quality_score,
         communication_score, recommendation, feedback
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (interview_id, reviewer_id) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        interviewId,
        userId,
        problemSolving,
        codeQuality,
        communication,
        recommendation,
        feedback.trim(),
      ],
    );

    if (result.rowCount === 0) {
      res.status(409).json({
        error: "You have already evaluated this interview.",
      });
      return;
    }

    res.status(201).json({
      message: "Evaluation submitted successfully.",
    });
}
