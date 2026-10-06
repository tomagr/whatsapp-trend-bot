import type { PrismaClient } from "@/lib/generated/prisma/client";

type Profile = { email: string; name?: string | null; image?: string | null };

// Called on each sign-in: adds the person the first time, refreshes name, photo and last sign-in after that.
export async function recordSignIn(prisma: PrismaClient, p: Profile, now = new Date()) {
  const email = p.email.toLowerCase();
  const info = { name: p.name ?? null, image: p.image ?? null, lastSeenAt: now };
  return prisma.user.upsert({ where: { email }, create: { email, ...info, firstSeenAt: now }, update: info });
}

export async function isSuperadmin(prisma: PrismaClient, email: string | null | undefined) {
  if (!email) return false;
  const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { superadmin: true } });
  return !!u?.superadmin;
}

export function listUsers(prisma: PrismaClient) {
  return prisma.user.findMany({ orderBy: [{ lastSeenAt: "desc" }, { email: "asc" }] });
}
