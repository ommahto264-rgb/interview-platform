import { Router } from "express";
import { createHash } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";

export const invitationRouter = Router();

invitationRouter.post("/accept", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const { token } = req.body ?? {};

  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    res.status(400).json({ error: "Invalid invitation token." });
    return;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const userId = res.locals.auth.userId;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT interview_id
       FROM interview_invitations
       WHERE token_hash = $1`,
      [tokenHash],
    );

    const invitation = lookup.rows[0];

    if (!invitation) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Invitation is unavailable." });
      return;
    }

    // Lock the interview first, as invitation creation does.
    const interviews = await client.query(
      `SELECT id
       FROM interviews
       WHERE id = $1
         AND status = 'SCHEDULED'
         AND scheduled_end_at > NOW()
       FOR UPDATE`,
      [invitation.interview_id],
    );

    if (interviews.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "This interview is no longer accepting candidates.",
      });
      return;
    }

    // Recheck the invitation after acquiring the interview lock.
    const invitations = await client.query(
      `SELECT inv.id
       FROM interview_invitations inv
       JOIN users u ON u.email = inv.email
       WHERE inv.token_hash = $1
         AND inv.interview_id = $2
         AND u.id = $3
         AND inv.accepted_at IS NULL
         AND inv.revoked_at IS NULL
         AND inv.expires_at > NOW()
       FOR UPDATE OF inv`,
      [tokenHash, invitation.interview_id, userId],
    );

    const validInvitation = invitations.rows[0];

    if (!validInvitation) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: "Invitation is unavailable or does not match your account.",
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
      [invitation.interview_id, userId, validInvitation.id],
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
       SET accepted_at = NOW()
       WHERE id = $1`,
      [validInvitation.id],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  res.json({ message: "Invitation accepted successfully." });
});