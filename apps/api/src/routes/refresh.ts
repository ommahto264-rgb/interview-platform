import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { createToken } from "../utils/jwt";

export const refreshRouter = Router();

refreshRouter.post("/refresh", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const oldToken = req.cookies?.refresh_token;

  if (
    typeof oldToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(oldToken)
  ) {
    res.status(401).json({ error: "Please log in again." });
    return;
  }

  const oldHash = createHash("sha256")
    .update(oldToken)
    .digest("hex");

  const newToken = randomBytes(32).toString("hex");

  const newHash = createHash("sha256")
    .update(newToken)
    .digest("hex");

  const result = await pool.query(
    `UPDATE sessions
     SET token_hash = $1
     WHERE token_hash = $2
       AND expires_at > NOW()
     RETURNING user_id, expires_at`,
    [newHash, oldHash],
  );

  const session = result.rows[0];

  if (!session) {
    res.status(401).json({ error: "Please log in again." });
    return;
  }

  const accessToken = await createToken(session.user_id);
  const secure = process.env.NODE_ENV === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refresh_token", newToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    expires: new Date(session.expires_at),
  });

  res.status(200).json({
    message: "Login refreshed successfully.",
  });
});