import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../../../../packages/database/client";
import { requireAuth } from "../middleware/require-auth";
import { requireAdmin } from "../middleware/require-admin";
import { requireMember } from "../middleware/require-member";

export const challengeRouter = Router();

challengeRouter.post(
  "/:organizationId/challenges",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { title, description, starterCode, tests } = req.body ?? {};

    if (
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.trim().length > 200
    ) {
      res.status(400).json({
        error: "Title must contain between 1 and 200 characters.",
      });
      return;
    }

    if (
      typeof description !== "string" ||
      description.trim().length === 0 ||
      description.length > 12000
    ) {
      res.status(400).json({
        error: "Description must contain between 1 and 12000 characters.",
      });
      return;
    }

    if (
      typeof starterCode !== "string" ||
      starterCode.trim().length === 0 ||
      starterCode.length > 10000
    ) {
      res.status(400).json({
        error: "Starter code must contain between 1 and 10000 characters.",
      });
      return;
    }

    if (!Array.isArray(tests) || tests.length < 1 || tests.length > 100) {
      res.status(400).json({
        error: "Provide between 1 and 100 test cases.",
      });
      return;
    }

    for (const test of tests) {
      if (
        !test ||
        !Array.isArray(test.input) ||
        !Object.hasOwn(test, "expectedOutput") ||
        typeof test.isHidden !== "boolean"
      ) {
        res.status(400).json({
          error: "Each test needs an input array, expectedOutput, and an isHidden boolean.",
        });
        return;
      }
    }

    const userId = res.locals.auth.userId;
    const organizationId = req.params.organizationId;
    const challengeId = randomUUID();
    const versionId = randomUUID();

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO challenges (id, organization_id, created_by)
         VALUES ($1, $2, $3)`,
        [challengeId, organizationId, userId],
      );

      await client.query(
        `INSERT INTO challenge_versions (
           id, challenge_id, version_number,
           title, description, starter_code, created_by
         )
         VALUES ($1, $2, 1, $3, $4, $5, $6)`,
        [
          versionId,
          challengeId,
          title.trim(),
          description.trim(),
          starterCode,
          userId,
        ],
      );

      for (let i = 0; i < tests.length; i++) {
        const test = tests[i];

        await client.query(
          `INSERT INTO challenge_test_cases (
             id, challenge_version_id, position,
             input, expected_output, is_hidden
           )
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
          [
            randomUUID(),
            versionId,
            i + 1,
            JSON.stringify(test.input),
            JSON.stringify(test.expectedOutput),
            test.isHidden,
          ],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.status(201).json({
      message: "Challenge created successfully.",
    });
  },
);

challengeRouter.get(
  "/:organizationId/challenges",
  requireAuth,
  requireMember,
  async (req, res) => {
    const result = await pool.query(
      `SELECT
         c.id,
         v.id AS version_id,
         v.version_number,
         v.title,
         v.language,
         c.created_at
       FROM challenges c
       JOIN challenge_versions v ON v.challenge_id = c.id
       WHERE c.organization_id = $1
         AND v.version_number = (
           SELECT MAX(version_number)
           FROM challenge_versions
           WHERE challenge_id = c.id
         )
       ORDER BY c.created_at DESC, c.id
       LIMIT 50`,
      [req.params.organizationId],
    );

    res.setHeader("Cache-Control", "no-store");

    res.json({
      challenges: result.rows,
    });
  },
);