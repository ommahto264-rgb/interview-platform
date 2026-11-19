import type { Request, Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";

export async function createInterviewInvitation(req: Request, res: Response) {

    const { organizationId, interviewId } = req.params;
    const { email } = req.body ?? {};

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof interviewId !== "string" ||
      !uuidPattern.test(interviewId)
    ) {
      res.status(400).json({ error: "Invalid interview ID." });
      return;
    }

    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      res.status(400).json({ error: "Enter a valid candidate email." });
      return;
    }

    const userId = res.locals.auth.userId;
    const role = res.locals.organizationRole;
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, status, scheduled_end_at
         FROM interviews
         WHERE id = $1
           AND organization_id = $2
           AND ($3::text = 'ADMIN' OR interviewer_id = $4)
         FOR UPDATE`,
        [interviewId, organizationId, role, userId],
      );

      const interview = result.rows[0];

      if (!interview) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Interview not found." });
        return;
      }

      if (
        interview.status !== "SCHEDULED" ||
        new Date(interview.scheduled_end_at).getTime() <= Date.now()
      ) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "This interview is no longer open for invitations.",
        });
        return;
      }

      const candidate = await client.query(
        "SELECT user_id FROM interview_candidates WHERE interview_id = $1",
        [interviewId],
      );

      if (candidate.rowCount !== 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "This interview already has a candidate.",
        });
        return;
      }

      // Creating a replacement invitation invalidates previous unused ones.
      await client.query(
        `UPDATE interview_invitations
         SET revoked_at = NOW()
         WHERE interview_id = $1
           AND accepted_at IS NULL
           AND revoked_at IS NULL`,
        [interviewId],
      );

      await client.query(
        `INSERT INTO interview_invitations (
           id, interview_id, email, token_hash, invited_by, expires_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           LEAST(NOW() + INTERVAL '7 days', $6::timestamptz)
         )`,
        [
          randomUUID(),
          interviewId,
          email.trim().toLowerCase(),
          tokenHash,
          userId,
          interview.scheduled_end_at,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.setHeader("Cache-Control", "no-store");

    if (process.env.NODE_ENV === "production") {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VERIFICATION_FROM;
  let emailAccepted = false;

  if (apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email.trim().toLowerCase()],
          subject: "You're invited to an interview",
          text: [
            "You have a new interview invitation.",
            "Sign in to Interview Platform using this email address.",
            "Open Invitations on your dashboard to review and accept it.",
          ].join("\n\n"),
        }),
        signal: AbortSignal.timeout(8000),
      });

      emailAccepted = response.ok;
      if (!response.ok) {
        console.warn("Interview invitation email rejected:", response.status);
      }
    } catch {
      console.warn("Could not confirm interview invitation email delivery.");
    }
  }

  res.status(201).json({
    emailAccepted,
    message: emailAccepted
      ? "Invitation created. Email accepted for delivery."
      : "Invitation created. Email delivery was not confirmed. The candidate can accept it from their dashboard.",
  });
  return;
}

    res.status(201).json({
      message: "Invitation created for local testing.",
      invitationToken: token,
    });
}
