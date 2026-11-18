import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";
import { requireAdmin } from "../middleware/require-admin";
import { requireVerifiedEmail } from "../middleware/require-verified-email";

export const organizationInvitationRouter = Router();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Create an invitation. No membership is created here.
organizationInvitationRouter.post(
  "/organizations/:organizationId/invitations",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { email } = req.body ?? {};

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const organizationId = req.params.organizationId;
    const userId = res.locals.auth.userId;

    const token = randomBytes(32).toString("hex");
    const invitationId = randomUUID();

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Serialize invitation creation within this organization.
      await client.query(
        `SELECT id
         FROM organizations
         WHERE id = $1
         FOR NO KEY UPDATE`,
        [organizationId],
      );

      const member = await client.query(
        `SELECT m.id
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.organization_id = $1 AND u.email = $2`,
        [organizationId, cleanEmail],
      );

      if (member.rowCount !== 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: "This user is already a member.",
        });
        return;
      }

      // Resending invalidates any previous unused invitation.
      await client.query(
        `UPDATE organization_invitations
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE organization_id = $1
           AND email = $2
           AND accepted_at IS NULL
           AND revoked_at IS NULL`,
        [organizationId, cleanEmail],
      );

      const result = await client.query(
        `INSERT INTO organization_invitations (
           id,
           organization_id,
           email,
           token_hash,
           invited_by,
           expires_at
         )
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP + INTERVAL '7 days')
         RETURNING expires_at`,
        [
          invitationId,
          organizationId,
          cleanEmail,
          hashToken(token),
          userId,
        ],
      );

      await client.query("COMMIT");

      res.setHeader("Cache-Control", "no-store");
      res.status(201).json({
        message: "Invitation created. Share the link with the recipient.",
        invitationToken: token,
        expiresAt: result.rows[0].expires_at,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);

// List invitations that have not been accepted or cancelled.
// Expired invitations remain visible so admins can resend them.
organizationInvitationRouter.get(
  "/organizations/:organizationId/invitations",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const result = await pool.query(
      `SELECT
         id,
         email,
         role,
         created_at,
         expires_at,
         CASE
           WHEN expires_at <= CURRENT_TIMESTAMP THEN 'EXPIRED'
           ELSE 'PENDING'
         END AS status
       FROM organization_invitations
       WHERE organization_id = $1
         AND accepted_at IS NULL
         AND revoked_at IS NULL
       ORDER BY created_at DESC, id
       LIMIT 100`,
      [req.params.organizationId],
    );

    res.setHeader("Cache-Control", "no-store");
    res.json({ invitations: result.rows });
  },
);

// Cancel an invitation within the administrator's organization.
organizationInvitationRouter.post(
  "/organizations/:organizationId/invitations/:invitationId/revoke",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { organizationId, invitationId } = req.params;

    if (
      typeof invitationId !== "string" ||
      !uuidPattern.test(invitationId)
    ) {
      res.status(400).json({ error: "Invalid invitation ID." });
      return;
    }

    const result = await pool.query(
      `UPDATE organization_invitations
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND organization_id = $2
         AND accepted_at IS NULL
         AND revoked_at IS NULL
       RETURNING id`,
      [invitationId, organizationId],
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        error: "An open invitation was not found.",
      });
      return;
    }

    res.json({ message: "Invitation cancelled successfully." });
  },
);

// Only the signed-in recipient can accept an invitation.
organizationInvitationRouter.post(
  "/organization-invitations/accept",
  requireAuth, requireVerifiedEmail,
  async (req, res) => {
    const { token } = req.body ?? {};

    if (
      typeof token !== "string" ||
      !/^[0-9a-f]{64}$/.test(token)
    ) {
      res.status(400).json({ error: "Invalid invitation token." });
      return;
    }

    const userId = res.locals.auth.userId;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT
           invitation.id,
           invitation.organization_id,
           invitation.email,
           invitation.accepted_at,
           invitation.revoked_at,
           invitation.expires_at <= CURRENT_TIMESTAMP AS expired,
           u.email AS account_email
         FROM organization_invitations invitation
         JOIN users u ON u.id = $2
         WHERE invitation.token_hash = $1
         FOR UPDATE OF invitation`,
        [hashToken(token), userId],
      );

      const invitation = result.rows[0];

      if (
        !invitation ||
        invitation.accepted_at ||
        invitation.revoked_at ||
        invitation.expired
      ) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "This invitation is invalid, expired, or already used.",
        });
        return;
      }

      if (invitation.email !== invitation.account_email) {
        await client.query("ROLLBACK");
        res.status(403).json({
          error: "Sign in with the email address this invitation was sent to.",
        });
        return;
      }

      await client.query(
        `INSERT INTO organization_memberships (
           id,
           user_id,
           organization_id,
           role
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
        message: "Invitation accepted. You are now an organization member.",
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);