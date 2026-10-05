import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// DATABASE_URL lives in the project root .env, shared with the Python job.
config({ path: path.join(import.meta.dirname, "..", ".env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
