import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";

export async function createInterview(req: Request, res: Response) {
    const {
      title,
      interviewerId,
      versionId,
      startTime,
      endTime,
    } = req.body ?? {};

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.trim().length > 200
    ) {
      res.status(400).json({ error: "Enter a title of 1–200 characters." });
      return;
    }

    if (
      typeof interviewerId !== "string" ||
      !uuidPattern.test(interviewerId) ||
      typeof versionId !== "string" ||
      !uuidPattern.test(versionId)
    ) {
      res.status(400).json({
        error: "Valid interviewer and challenge version IDs are required.",
      });
      return;
    }

    // Accept UTC timestamps, for example: 2026-11-15T08:30:00.000Z
    const timePattern =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

    if (
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !timePattern.test(startTime) ||
      !timePattern.test(endTime)
    ) {
      res.status(400).json({
        error: "Use UTC timestamps: YYYY-MM-DDTHH:mm:ss.sssZ.",
      });
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start.toISOString() !== startTime ||
      end.toISOString() !== endTime
    ) {
      res.status(400).json({ error: "Invalid date or time." });
      return;
    }

    if (start.getTime() <= Date.now() || end.getTime() <= start.getTime()) {
      res.status(400).json({
        error: "Start must be in the future, and end must be after start.",
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO interviews (
         id, organization_id, challenge_id, challenge_version_id,
         title, interviewer_id, created_by,
         scheduled_start_at, scheduled_end_at
       )
       SELECT
         $1, c.organization_id, c.id, v.id,
         $2, m.user_id, $3, $4, $5
       FROM challenge_versions v
       JOIN challenges c ON c.id = v.challenge_id
       JOIN organization_memberships m
         ON m.organization_id = c.organization_id
       WHERE v.id = $6
         AND c.organization_id = $7
         AND m.user_id = $8
         AND m.role IN ('ADMIN', 'INTERVIEWER')
       RETURNING id`,
      [
        randomUUID(),
        title.trim(),
        res.locals.auth.userId,
        start,
        end,
        versionId,
        req.params.organizationId,
        interviewerId,
      ],
    );

    if (result.rowCount === 0) {
      res.status(400).json({
        error: "Choose a challenge version and interviewer from this organization.",
      });
      return;
    }

    res.status(201).json({
      message: "Interview scheduled successfully.",
    });
}

export async function listInterviews(req: Request, res: Response) {
    const userId = res.locals.auth.userId;
    const role = res.locals.organizationRole;

    const result = await pool.query(
      `SELECT
         i.id,
         i.title,
         i.status,
         i.scheduled_start_at,
         i.scheduled_end_at,
         i.interviewer_id,
         u.name AS interviewer_name,
         v.title AS challenge_title,
         v.version_number
       FROM interviews i
       JOIN users u ON u.id = i.interviewer_id
       JOIN challenge_versions v ON v.id = i.challenge_version_id
       WHERE i.organization_id = $1
         AND ($2::text = 'ADMIN' OR i.interviewer_id = $3)
       ORDER BY i.scheduled_start_at DESC, i.id
       LIMIT 50`,
      [req.params.organizationId, role, userId],
    );

    res.setHeader("Cache-Control", "no-store");

    res.json({
      interviews: result.rows,
    });
}

export async function getInterview(req: Request, res: Response) {
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
      `SELECT
         i.id,
         i.title,
         i.status,
         i.scheduled_start_at,
         i.scheduled_end_at,
         i.interviewer_id,
         u.name AS interviewer_name,
         v.id AS challenge_version_id,
         v.version_number,
         v.title AS challenge_title,
         v.description,
         v.language,
         v.starter_code
       FROM interviews i
       JOIN users u ON u.id = i.interviewer_id
       JOIN challenge_versions v ON v.id = i.challenge_version_id
       WHERE i.id = $1
         AND i.organization_id = $2
         AND ($3::text = 'ADMIN' OR i.interviewer_id = $4)`,
      [interviewId, organizationId, role, userId],
    );

    const interview = result.rows[0];

    res.setHeader("Cache-Control", "no-store");

    if (!interview) {
      res.status(404).json({ error: "Interview not found." });
      return;
    }

    res.json({ interview });
}
