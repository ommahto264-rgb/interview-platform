import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";

export const invitationInboxRouter = Router();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only return invitations addressed to the signed-in account.
invitationInboxRouter.get("/", requireAuth, async (_req, res) => {
  const userId = res.locals.auth.userId;

  const [organizations, interviews] = await Promise.all([
    pool.query(
      `SELECT
         inv.id,
         o.name AS organization_name,
         inv.role,
         inv.created_at,
         inv.expires_at
       FROM organization_invitations inv
       JOIN organizations o ON o.id = inv.organization_id
       JOIN users u ON u.email = inv.email
       WHERE u.id = $1
         AND inv.accepted_at IS NULL
         AND inv.revoked_at IS NULL
         AND inv.expires_at > CURRENT_TIMESTAMP
         AND NOT EXISTS (
           SELECT 1
           FROM organization_memberships m
           WHERE m.organization_id = inv.organization_id
             AND m.user_id = u.id
         )
       ORDER BY inv.created_at DESC, inv.id
       LIMIT 100`,
      [userId],
    ),

    pool.query(
      `SELECT
         inv.id,
         i.title AS interview_title,
         o.name AS organization_name,
         i.scheduled_start_at,
         i.scheduled_end_at,
         inv.expires_at
       FROM interview_invitations inv
       JOIN interviews i ON i.id = inv.interview_id
       JOIN organizations o ON o.id = i.organization_id
       JOIN users u ON u.email = inv.email
       WHERE u.id = $1
         AND inv.accepted_at IS NULL
         AND inv.revoked_at IS NULL
         AND inv.expires_at > CURRENT_TIMESTAMP
         AND i.status = 'SCHEDULED'
         AND i.scheduled_end_at > CURRENT_TIMESTAMP
         AND NOT EXISTS (
           SELECT 1
           FROM interview_candidates c
           WHERE c.interview_id = i.id
         )
       ORDER BY i.scheduled_start_at, inv.id
       LIMIT 100`,
      [userId],
    ),
  ]);

  res.setHeader("Cache-Control", "no-store");

  res.json({
    organizationInvitations: organizations.rows,
    interviewInvitations: interviews.rows,
  });
});

// Accept an organization invitation.
invitationInboxRouter.post(
  "/organizations/:invitationId/accept",
  requireAuth,
  async (req, res) => {
    const { invitationId } = req.params;
    const userId = res.locals.auth.userId;

    if (
      typeof invitationId !== "string" ||
      !uuidPattern.test(invitationId)
    ) {
      res.status(400).json({ error: "Invalid invitation ID." });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT inv.id, inv.organization_id
         FROM organization_invitations inv
         JOIN users u ON u.email = inv.email
         WHERE inv.id = $1
           AND u.id = $2
           AND inv.accepted_at IS NULL
           AND inv.revoked_at IS NULL
           AND inv.expires_at > CURRENT_TIMESTAMP
         FOR UPDATE OF inv`,
        [invitationId, userId],
      );

      const invitation = result.rows[0];

      if (!invitation) {
        await client.query("ROLLBACK");
        res.status(404).json({
          error: "This invitation is unavailable or does not match your account.",
        });
        return;
      }

      await client.query(
        `INSERT INTO organization_memberships (
           id, user_id, organization_id, role
         )
         VALUES ($1, $2, $3, 'INTERVIEWER')
         ON CONFLICT (user_id, organization_id) DO NOTHING`,
        [randomUUID(), userId, invitation.organization_id],
      );

      await client.query(
        `UPDATE organization_invitations
         SET accepted_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [invitation.id],
      );

      await client.query("COMMIT");

      res.setHeader("Cache-Control", "no-store");
      res.json({
        message: "Organization invitation accepted successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);

// Accept an interview invitation.
invitationInboxRouter.post(
  "/interviews/:invitationId/accept",
  requireAuth,
  async (req, res) => {
    const { invitationId } = req.params;
    const userId = res.locals.auth.userId;

    if (
      typeof invitationId !== "string" ||
      !uuidPattern.test(invitationId)
    ) {
      res.status(400).json({ error: "Invalid invitation ID." });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const lookup = await client.query(
        `SELECT inv.interview_id
         FROM interview_invitations inv
         JOIN users u ON u.email = inv.email
         WHERE inv.id = $1 AND u.id = $2`,
        [invitationId, userId],
      );

      const invitation = lookup.rows[0];

      if (!invitation) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Invitation unavailable." });
        return;
      }

      // Keep the same lock order as interview invitation creation:
      // interview first, then invitation.
      const interview = await client.query(
        `SELECT id
         FROM interviews
         WHERE id = $1
           AND status = 'SCHEDULED'
           AND scheduled_end_at > CURRENT_TIMESTAMP
         FOR UPDATE`,
        [invitation.interview_id],
      );

      if (interview.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "This interview is no longer accepting candidates.",
        });
        return;
      }

      const validInvitation = await client.query(
        `SELECT inv.id
         FROM interview_invitations inv
         JOIN users u ON u.email = inv.email
         WHERE inv.id = $1
           AND inv.interview_id = $2
           AND u.id = $3
           AND inv.accepted_at IS NULL
           AND inv.revoked_at IS NULL
           AND inv.expires_at > CURRENT_TIMESTAMP
         FOR UPDATE OF inv`,
        [invitationId, invitation.interview_id, userId],
      );

      if (validInvitation.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({
          error: "This invitation is expired, cancelled, or already accepted.",
        });
        return;
      }

      const candidate = await client.query(
        `INSERT INTO interview_candidates (
           interview_id, user_id, invitation_id
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (interview_id) DO NOTHING
         RETURNING interview_id`,
        [invitation.interview_id, userId, invitationId],
      );

      if (candidate.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "This interview already has a candidate.",
        });
        return;
      }

      await client.query(
        `UPDATE interview_invitations
         SET accepted_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [invitationId],
      );

      await client.query("COMMIT");

      res.setHeader("Cache-Control", "no-store");
      res.json({
        message: "Interview invitation accepted successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);