import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { pool } from "../../../../packages/database/client";
import { createToken } from "../utils/jwt";

export const loginRouter = Router();

loginRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.trim().length === 0 ||
    email.length > 254 ||
    password.length === 0 ||
    password.length > 128
  ) {
    res.status(400).json({
      error: "Enter a valid email and password.",
    });
    return;
  }

  const result = await pool.query(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email.trim().toLowerCase()],
  );

  const user = result.rows[0];

  if (!user) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const correctPassword = await argon2.verify(
    user.password_hash,
    password,
  );

  if (!correctPassword) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const accessToken = await createToken(user.id);

  const refreshToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')`,
    [randomUUID(), user.id, tokenHash],
  );

  const secure = process.env.NODE_ENV === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Remove the cookie used by our previous login implementation.
  res.clearCookie("session", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    message: "Logged in successfully.",
  });
});