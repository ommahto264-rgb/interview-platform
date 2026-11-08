import type { Request, Response, NextFunction } from "express";
import { pool } from "../../../../packages/database/client";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const organizationId = req.params.organizationId;
  const userId = res.locals.auth.userId;

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof organizationId !== "string" ||
    !uuidPattern.test(organizationId)
  ) {
    res.status(400).json({ error: "Invalid organization ID." });
    return;
  }

  const result = await pool.query(
    `SELECT role
     FROM organization_memberships
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId],
  );

  const membership = result.rows[0];

  if (!membership) {
    res.status(404).json({ error: "Organization not found." });
    return;
  }

  if (membership.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}