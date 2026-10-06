import { afterAll, beforeAll, expect, test } from "vitest";
import { pgConfig } from "@/lib/pgConfig";
import { createTestDb } from "./helpers";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });

test("connects and sees the migrated tables", async () => {
  await t.prisma.group.create({ data: { key: "g", slug: "g", name: "G", lang: "es", vendorMode: "sentiment" } });
  expect(await t.prisma.group.count()).toBe(1);
});

// The local database (no DATABASE_URL, or a localhost one) has no TLS to check.
test.skipIf(!pgConfig(process.env.DATABASE_URL || "postgres://localhost").ssl)("connects to a hosted database over verified TLS", async () => {
  const [{ ssl }] = await t.prisma.$queryRaw<{ ssl: boolean }[]>`SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
  expect(ssl).toBe(true);
});
