import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { pgConfig } from "./pgConfig";

export function makePrisma(url?: string) {
  const c = pgConfig(url);
  // Timeouts, so that a connection the Mac opened just before sleeping cannot hang a process forever (the poller
  // once waited a day on one; launchd never starts a second poller while one is running). Keep-alives let the OS
  // notice a dead connection on its own.
  const adapter = new PrismaPg(
    {
      connectionString: c.connectionString, ssl: c.ssl, max: 5, options: `-c search_path=${c.schema}`,
      connectionTimeoutMillis: 15_000, query_timeout: 60_000, keepAlive: true,
    },
    { schema: c.schema }, // Prisma schema-qualifies its SQL; search_path alone only covers raw queries
  );
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Lazy so that importing a page module during `next build` does not need DATABASE_URL.
export function db() {
  return (globalForPrisma.prisma ??= makePrisma());
}
