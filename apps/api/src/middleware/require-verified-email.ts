import type { Request, Response, NextFunction } from "express";
import { pool } from "../../../../packages/database/client";

export async function requireVerifiedEmail(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  // requireAuth runs first and provides the signed-in user's ID.
  const userId = res.locals.auth.userId;

  const result = await pool.query(
    `SELECT email_verified_at
     FROM users
     WHERE id = $1`,
    [userId],
  );

  const user = result.rows[0];

  if (!user) {
    res.status(401).json({ error: "Please sign in again." });
    return;
  }

  if (!user.email_verified_at) {
    res.status(403).json({
      code: "EMAIL_VERIFICATION_REQUIRED",
      error: "Verify your email from the dashboard to view or accept invitations.",
    });
    return;
  }

  next();
}