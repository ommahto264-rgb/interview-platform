import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";

export const emailVerificationRouter = Router();

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

emailVerificationRouter.post(
  "/email-verification/request",
  requireAuth,
  async (_req, res) => {
    const userId = res.locals.auth.userId;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.VERIFICATION_FROM;

    if (!apiKey || !from) {
      res.status(503).json({
        error: "Verification email delivery is not configured.",
      });
      return;
    }

    const code = randomBytes(8).toString("hex").toUpperCase();

    // Use the signed-in user's email. The browser cannot choose the recipient.
    const issued = await pool.query(
      `INSERT INTO email_verification_tokens AS existing
         (user_id, email, token_hash, created_at, expires_at)
       SELECT id, email, $2, NOW(), NOW() + INTERVAL '15 minutes'
       FROM users
       WHERE id = $1 AND email_verified_at IS NULL
       ON CONFLICT (user_id) DO UPDATE SET
         email = EXCLUDED.email,
         token_hash = EXCLUDED.token_hash,
         created_at = EXCLUDED.created_at,
         expires_at = EXCLUDED.expires_at
       WHERE existing.created_at <= NOW() - INTERVAL '2 minutes'
       RETURNING email`,
      [userId, hashCode(code)],
    );

    if (issued.rowCount === 0) {
      const account = await pool.query(
        "SELECT email_verified_at FROM users WHERE id = $1",
        [userId],
      );

      if (!account.rows[0]) {
        res.status(401).json({ error: "Please sign in again." });
      } else if (account.rows[0].email_verified_at) {
        res.json({ message: "Your email is already verified." });
      } else {
        res.set("Retry-After", "120").status(429).json({
          error: "Wait two minutes before requesting another code.",
        });
      }
      return;
    }

    const displayCode = code.match(/.{4}/g)!.join("-");

    try {
      const delivery = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [issued.rows[0].email],
          subject: "Verify your Interview Platform email",
          text:
            `Your verification code is ${displayCode}.\n\n` +
            "Enter it in Interview Platform within 15 minutes. " +
            "If you did not request this code, you can ignore this email.",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!delivery.ok) throw new Error("Email provider rejected the request.");
    } catch {
      res.status(503).json({
        error: "Email delivery could not be confirmed. Check your inbox or retry in two minutes.",
      });
      return;
    }

    res.status(202).json({
      message: "Check your email for the verification code.",
    });
  },
);

emailVerificationRouter.post(
  "/email-verification/confirm",
  requireAuth,
  async (req, res) => {
    const rawCode = req.body?.code;
    const code =
      typeof rawCode === "string"
        ? rawCode.trim().replace(/-/g, "").toUpperCase()
        : "";

    if (!/^[A-F0-9]{16}$/.test(code)) {
      res.status(400).json({
        error: "Enter the 16-character code from your email.",
      });
      return;
    }

    // One SQL statement consumes the code and verifies its matching account.
    const result = await pool.query(
      `WITH used AS (
         DELETE FROM email_verification_tokens
         WHERE user_id = $1
           AND token_hash = $2
           AND expires_at > NOW()
         RETURNING user_id, email
       )
       UPDATE users AS u
       SET email_verified_at = NOW()
       FROM used
       WHERE u.id = used.user_id
         AND u.email = used.email
         AND u.email_verified_at IS NULL
       RETURNING u.id`,
      [res.locals.auth.userId, hashCode(code)],
    );

    if (result.rowCount === 0) {
      res.status(400).json({
        error: "That code is invalid, expired, or already used.",
      });
      return;
    }

    res.json({ message: "Email verified successfully." });
  },
);

emailVerificationRouter.get(
  "/email-verification/status",
  requireAuth,
  async (_req, res) => {
    const result = await pool.query(
      `SELECT email_verified_at IS NOT NULL AS verified
       FROM users
       WHERE id = $1`,
      [res.locals.auth.userId],
    );

    if (!result.rows[0]) {
      res.status(401).json({ error: "Please sign in again." });
      return;
    }

    res.set("Cache-Control", "no-store");
    res.json({ verified: result.rows[0].verified });
  },
);