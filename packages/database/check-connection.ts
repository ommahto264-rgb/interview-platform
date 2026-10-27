import { pool } from "./client";

async function main() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM organizations) AS organizations,
      (SELECT COUNT(*)::int FROM organization_memberships) AS memberships;
  `);

  console.log("Connected to Neon successfully.");
  console.table(result.rows);
}

main()
  .catch((error) => {
    console.error("Database check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });