import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { pgConfig } from "./pgConfig";

export function makePrisma(url?: string) {
  const c = pgConfig(url);
  const adapter = new PrismaPg(
    { connectionString: c.connectionString, ssl: c.ssl, max: 5, options: `-c search_path=${c.schema}` },
    { schema: c.schema }, // Prisma schema-qualifies its SQL; search_path alone only covers raw queries
  );
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Lazy so that importing a page module during `next build` does not need DATABASE_URL.
export function db() {
  return (globalForPrisma.prisma ??= makePrisma());
}
