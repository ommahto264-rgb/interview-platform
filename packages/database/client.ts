import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing.");
}

export const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 30_000,
  statement_timeout: 10_000,
  query_timeout: 15_000,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (error) => {
  console.error("Unexpected idle database connection error:", error.message);
});