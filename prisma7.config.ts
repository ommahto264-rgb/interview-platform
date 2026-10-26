import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "packages/database/schema.prisma",

  migrations: {
    path: "packages/database/migrations",
  },

  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
});