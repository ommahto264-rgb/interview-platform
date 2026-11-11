import express, { type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import * as argon2 from "argon2";
import { pool } from "../../../packages/database/client";
import {loginRouter} from "./routes/login";
import cookieParser from "cookie-parser";
import { requireAuth } from "./middleware/require-auth";
import { refreshRouter } from "./routes/refresh";
import { logoutRouter } from "./routes/logout";
import { organizationRouter } from "./routes/organizations";
import { challengeRouter } from "./routes/challenges";
import { interviewRouter } from "./routes/interviews";
import { invitationRouter } from "./routes/invitations";
import { candidateInterviewRouter } from "./routes/candidate-interviews";
import { organizationInvitationRouter } from "./routes/organization-invitations";
import { invitationInboxRouter } from "./routes/invitation-inbox";

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.use("/api/auth", loginRouter);
app.use("/api/auth", refreshRouter);
app.use("/api/auth", logoutRouter);
app.use("/api/organizations", organizationRouter);
app.use("/api/organizations", challengeRouter);
app.use("/api/organizations", interviewRouter);
app.use("/api/invitations", invitationRouter);
app.use("/api/candidate/interviews", candidateInterviewRouter);
app.use("/api", organizationInvitationRouter);
app.use("/api/invitation-inbox", invitationInboxRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
  const body = req.body;

  // Never assume incoming data has the expected shape.
  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    res.status(400).json({
      error: "Name, email, and password must be strings.",
    });
    return;
  }

  const name = body.name.trim();
  const email = body.email.trim().toLowerCase();

  // Do not trim passwords: spaces may be intentional.
  const password = body.password;

  if (name.length < 2 || name.length > 100) {
    res.status(400).json({
      error: "Name must contain between 2 and 100 characters.",
    });
    return;
  }

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    res.status(400).json({
      error: "Enter a valid email address.",
    });
    return;
  }

  if (password.length < 8 || password.length > 128) {
  res.status(400).json({
    error: "Password must contain between 8 and 128 characters.",
  });
  return;
}

if (!/[A-Z]/.test(password)) {
  res.status(400).json({
    error: "Password must contain at least one uppercase letter.",
  });
  return;
}

if (!/[\p{P}\p{S}]/u.test(password)) {
  res.status(400).json({
    error: "Password must contain at least one special character.",
  });
  return;
}

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const result = await pool.query(
    `
      INSERT INTO users (
        id,
        name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `,
    [randomUUID(), name, email, passwordHash],
  );

  if (result.rowCount === 0) {
    res.status(409).json({
      error: "An account with this email already exists.",
    });
    return;
  }

  res.status(201).json({
    message: "Account created successfully.",
  });
});

app.get("/api/auth/session", requireAuth, (_req, res) => {
  res.status(200).json({
    message: "You are authenticated.",
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body contains invalid JSON." });
    return;
  }

  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large." });
    return;
  }

  // Do not log request bodies, passwords, or connection strings.
  console.error("Request failed:", {
    name: error?.name,
    code: error?.code,
  });

  res.status(500).json({
    error: "An unexpected server error occurred.",
  });
};

app.use(errorHandler);

