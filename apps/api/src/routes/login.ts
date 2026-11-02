import { Router } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { pool } from "../../../../packages/database/client";

export const loginRouter = Router();

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type LoginUser = {
  id: string;
  password_hash: string;
};

loginRouter.post("/login", async (req, res) => {
  const body = req.body;

  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    res.status(400).json({
      error: "Email and password must be strings.",
    });
    return;
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (
    email.length === 0 ||
    email.length > 254 ||
    password.length === 0 ||
    password.length > 128
  ) {
    res.status(400).json({
      error: "Invalid email or password format.",
    });
    return;
  }

  const result = await pool.query<LoginUser>(
    `
      SELECT id, password_hash
      FROM users
      WHERE email = $1
    `,
    [email],
  );

  const user = result.rows[0];

  if (!user) {
    res.status(401).json({
      error: "Invalid email or password.",
    });
    return;
  }

  const passwordMatches = await argon2.verify(
    user.password_hash,
    password,
  );

  if (!passwordMatches) {
    res.status(401).json({
      error: "Invalid email or password.",
    });
    return;
  }

  // The cookie contains the random token.
  const token = randomBytes(32).toString("hex");

  // The database contains only its hash.
  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  await pool.query(
    `
      INSERT INTO sessions (
        id,
        user_id,
        token_hash,
        expires_at
      )
      VALUES (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP + INTERVAL '7 days'
      )
    `,
    [randomUUID(), user.id, tokenHash],
  );

  res.setHeader("Cache-Control", "no-store");

  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });

  res.status(200).json({
    message: "Logged in successfully.",
  });
});