import { Router } from "express";
import { createHash } from "node:crypto";
import { pool } from "../../../../packages/database/client";

export const logoutRouter = Router();

logoutRouter.post("/logout", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const token = req.cookies?.refresh_token;

  if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    await pool.query(
      "DELETE FROM sessions WHERE token_hash = $1",
      [tokenHash],
    );
  }

  const secure = process.env.NODE_ENV === "production";

  res.clearCookie("access_token", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
  });

  res.status(200).json({
    message: "Logged out successfully.",
  });
});