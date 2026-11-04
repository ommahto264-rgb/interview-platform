import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("Cache-Control", "no-store");

  const token = req.cookies?.access_token;

  if (typeof token !== "string" || !token) {
    res.status(401).json({ error: "Please log in." });
    return;
  }

  let userId: string;

  try {
    userId = await verifyToken(token);
  } catch {
    res.status(401).json({
      error: "Your login is invalid or expired. Please log in again.",
    });
    return;
  }

  res.locals.auth = { userId };

  next();
}