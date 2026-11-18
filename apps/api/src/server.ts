import { app } from "./app";
import { pool } from "../../../packages/database/client";

async function start() {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? "3000");

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a whole number between 1 and 65535.");
  }

  await pool.query("SELECT 1");

  const server = app.listen(port, host, () => {
    console.log(`API listening on ${host}:${port}`);
  });

  server.on("error", async (error) => {
    console.error("HTTP server failed:", error.message);
    await pool.end();
    process.exitCode = 1;
  });
}

start().catch(async (error) => {
  console.error("API startup failed:", error.message);
  await pool.end();
  process.exitCode = 1;
});