import { app } from "./app";
import { pool } from "../../../packages/database/client";

async function start() {
  // Check database connectivity before accepting requests.
  await pool.query("SELECT 1");

  const server = app.listen(3000, "127.0.0.1", () => {
    console.log("API running at http://127.0.0.1:3000");
  });

  server.on("error", async (error) => {
    console.error("HTTP server failed:", error.message);
    await pool.end();
    process.exitCode = 1;
  });
}

start().catch(async (error) => {
  console.error("API startup failed:", {
    name: error?.name,
    code: error?.code,
    causeCode: error?.cause?.code,
  });

  console.error("Error message:", error?.message);
  await pool.end();
  process.exitCode = 1;
});