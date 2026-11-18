import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import * as argon2 from "argon2";

export const passwordResetRouter = Router();

passwordResetRouter.post("/forgot-password", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const email = req.body?.email;
  if (
    typeof email !== "string" ||
    email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VERIFICATION_FROM;
  if (!apiKey || !from) {
    res.status(503).json({ error: "Password recovery is temporarily unavailable." });
    return;
  }

  const code = randomBytes(16).toString("hex").toUpperCase();
  const hash = createHash("sha256").update(code).digest("hex");

  const issued = await pool.query(
    `INSERT INTO password_reset_tokens AS existing
       (user_id, email, token_hash, created_at, expires_at)
     SELECT id, email, $2, NOW(), NOW() + INTERVAL '15 minutes'
     FROM users
     WHERE email = $1 AND email_verified_at IS NOT NULL
     ON CONFLICT (user_id) DO UPDATE SET
       email = EXCLUDED.email,
       token_hash = EXCLUDED.token_hash,
       created_at = EXCLUDED.created_at,
       expires_at = EXCLUDED.expires_at
     WHERE existing.created_at <= NOW() - INTERVAL '2 minutes'
     RETURNING email`,
    [email.trim().toLowerCase(), hash],
  );

  // Reply before contacting the mail provider, even when no email will be sent.
  res.status(202).json({
    message: "If this email belongs to a verified account, check your inbox for a reset code.",
  });

  if (!issued.rowCount) return;

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
        subject: "Reset your Interview Platform password",
        text: [
          "Copy this code into Interview Platform to reset your password:",
          code,
          "It expires in 15 minutes.",
          "If you did not request this, you can ignore this email. Your password has not changed.",
        ].join("\n\n"),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!delivery.ok) {
      console.error("Password reset email rejected:", delivery.status);
    }
  } catch {
    console.error("Password reset email delivery could not be confirmed.");
  }
});

passwordResetRouter.post("/reset-password", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const { email, code, newPassword } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof code !== "string" ||
    typeof newPassword !== "string"
  ) {
    res.status(400).json({ error: "Email, reset code, and new password are required." });
    return;
  }

  // Match the signup policy. Do not trim the password.
  if (
    newPassword.length < 8 ||
    newPassword.length > 128 ||
    !/[A-Z]/.test(newPassword) ||
    !/[\p{P}\p{S}]/u.test(newPassword)
  ) {
    res.status(400).json({
      error: "Use 8–128 characters, including an uppercase letter and a special character.",
    });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim().toUpperCase();
  const invalidCode = "This reset code is invalid, expired, or already used.";

  if (!/^[A-F0-9]{32}$/.test(cleanCode)) {
    res.status(400).json({ error: invalidCode });
    return;
  }

  const tokenHash = createHash("sha256").update(cleanCode).digest("hex");

  // Check the code before spending time hashing a new password.
  const token = await pool.query(
    `SELECT user_id FROM password_reset_tokens
     WHERE email = $1 AND token_hash = $2 AND expires_at > NOW()`,
    [cleanEmail, tokenHash],
  );

  if (!token.rowCount) {
    res.status(400).json({ error: invalidCode });
    return;
  }

  const passwordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check again while consuming the code: two requests cannot both use it.
    const used = await client.query(
      `DELETE FROM password_reset_tokens
       WHERE user_id = $1 AND email = $2
         AND token_hash = $3 AND expires_at > clock_timestamp()
       RETURNING user_id`,
      [token.rows[0].user_id, cleanEmail, tokenHash],
    );

    if (!used.rowCount) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: invalidCode });
      return;
    }

    const userId = used.rows[0].user_id;
    const updated = await client.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 AND email = $3 AND email_verified_at IS NOT NULL`,
      [passwordHash, userId, cleanEmail],
    );

    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: invalidCode });
      return;
    }

    await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  res.status(200).json({
    message: "Password reset successfully. Sign in with your new password.",
  });
});