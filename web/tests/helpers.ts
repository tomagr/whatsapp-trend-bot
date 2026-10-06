import { execFileSync } from "node:child_process";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";
import { makePrisma } from "@/lib/db";
import { localDatabaseUrl } from "@/lib/localDb";
import { pgConfig } from "@/lib/pgConfig";

config({ path: path.join(import.meta.dirname, "..", "..", ".env"), quiet: true });

// Each test file gets its own schema in trend_bot, migrated from scratch and dropped afterwards.
export async function createTestDb() {
  const base = new URL(process.env.DATABASE_URL || localDatabaseUrl());
  const schema = `test_${randomBytes(4).toString("hex")}`;
  base.searchParams.set("schema", schema);
  const url = base.toString();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: path.join(import.meta.dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  const prisma = makePrisma(url);
  return {
    prisma,
    url,
    async drop() {
      await prisma.$disconnect();
      const c = pgConfig(url);
      const client = new pg.Client({ connectionString: c.connectionString, ssl: c.ssl });
      await client.connect();
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    },
  };
}
