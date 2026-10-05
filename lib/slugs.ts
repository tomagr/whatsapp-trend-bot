import type { PrismaClient } from "./generated/prisma/client";

// Top-level paths that a group slug must not shadow.
const RESERVED = new Set(["login", "api", "_next", "favicon.ico"]);

export function slugError(slug: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Use lowercase letters, numbers and single hyphens.";
  if (slug.length < 2 || slug.length > 40) return "Use 2–40 characters.";
  if (RESERVED.has(slug)) return "That path is reserved.";
  return null;
}

// Resolves a URL segment to its group, or to the slug it should redirect to.
export async function resolveSlug(prisma: PrismaClient, slug: string) {
  const group = await prisma.group.findUnique({ where: { slug } });
  if (group) return { group };
  const alias = await prisma.groupSlugAlias.findUnique({ where: { slug }, include: { group: { select: { slug: true } } } });
  return alias ? { redirectTo: alias.group.slug } : {};
}

export async function renameGroupSlug(prisma: PrismaClient, key: string, raw: string) {
  const slug = raw.trim().toLowerCase();
  const err = slugError(slug);
  if (err) return { ok: false as const, error: err };
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { key } });
    if (!group) return { ok: false as const, error: "Unknown group." };
    if (group.slug === slug) return { ok: true as const, slug, previous: slug };
    const taken = await tx.group.findUnique({ where: { slug } });
    const alias = await tx.groupSlugAlias.findUnique({ where: { slug } });
    if (taken || (alias && alias.groupKey !== key)) return { ok: false as const, error: "Another group already uses that slug." };
    // Reclaiming one of this group's own past slugs: it stops being an alias.
    if (alias) await tx.groupSlugAlias.delete({ where: { slug } });
    await tx.groupSlugAlias.create({ data: { slug: group.slug, groupKey: key } });
    await tx.group.update({ where: { key }, data: { slug } });
    return { ok: true as const, slug, previous: group.slug };
  });
}
