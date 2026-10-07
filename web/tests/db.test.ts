import { afterAll, beforeAll, expect, test } from "vitest";
import net from "node:net";
import { makePrisma } from "@/lib/db";
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

// The poller once hung for a day on a connection the Mac opened during a 2-second wake and then slept on: with no
// timeouts, pg waits for the server forever, and launchd never starts a second poller while one is running.
test("gives up on a server that never answers instead of waiting forever", async () => {
  const server = net.createServer(() => {}); // accepts the connection and never replies
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as net.AddressInfo;
  const prisma = makePrisma(`postgres://u:p@127.0.0.1:${port}/db`);
  try {
    const outcome = await Promise.race([
      prisma.$queryRaw`SELECT 1`.then(() => "answered", () => "gave up"),
      new Promise<string>((r) => setTimeout(() => r("still waiting"), 20_000)),
    ]);
    expect(outcome).toBe("gave up");
  } finally {
    await prisma.$disconnect().catch(() => {});
    server.close();
  }
});
