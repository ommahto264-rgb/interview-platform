import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";
import { requireAdmin } from "../middleware/require-admin";

export const organizationRouter = Router();

organizationRouter.post("/", requireAuth, async (req, res) => {
  const { name, slug } = req.body ?? {};

  if (typeof name !== "string" || typeof slug !== "string") {
    res.status(400).json({
      error: "Organization name and slug are required.",
    });
    return;
  }

  const cleanName = name.trim();
  const cleanSlug = slug.trim().toLowerCase();

  if (cleanName.length < 2 || cleanName.length > 100) {
    res.status(400).json({
      error: "Name must contain between 2 and 100 characters.",
    });
    return;
  }

  if (
    cleanSlug.length < 3 ||
    cleanSlug.length > 60 ||
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)
  ) {
    res.status(400).json({
      error: "Slug must be 3–60 characters: lowercase letters, numbers, and single hyphens between words.",
    });
    return;
  }

  const userId = res.locals.auth.userId;
  const organizationId = randomUUID();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO organizations (id, name, slug, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [organizationId, cleanName, cleanSlug, userId],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");

      res.status(409).json({
        error: "This organization slug is already taken.",
      });
      return;
    }

    await client.query(
      `INSERT INTO organization_memberships (
         id, user_id, organization_id, role
       )
       VALUES ($1, $2, $3, 'ADMIN')`,
      [randomUUID(), userId, organizationId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  res.status(201).json({
    message: "Organization created successfully.",
  });
});

organizationRouter.get("/", requireAuth, async (_req, res) => {
  const userId = res.locals.auth.userId;

  const result = await pool.query(
    `SELECT
       o.id,
       o.name,
       o.slug,
       m.role
     FROM organizations o
     JOIN organization_memberships m
       ON m.organization_id = o.id
     WHERE m.user_id = $1
     ORDER BY o.created_at DESC, o.id`,
    [userId],
  );

  res.json({
    organizations: result.rows,
  });
});

organizationRouter.get(
  "/:organizationId/members",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const result = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         m.role
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at, m.id`,
      [req.params.organizationId],
    );

    res.json({ members: result.rows });
  },
);

organizationRouter.post(
  "/:organizationId/members",
  requireAuth,
  requireAdmin,
  (_req, res) => {
    res.status(410).json({
      error: "Direct member addition is disabled. Send an invitation instead.",
    });
  },
);