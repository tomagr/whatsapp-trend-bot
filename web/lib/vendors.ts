import type { PrismaClient } from "./generated/prisma/client";
import { vendorInput } from "./validation";

// What a logged-out visitor may see of a vendor: no group member's name, so neither who recommended it nor what
// they said (quotes can name people, children included). Applied server-side so nothing reaches their browser.
export function forVisitor<V extends { recommendedBy: string; quote: string }>(v: V): V {
  return { ...v, recommendedBy: "", quote: "" };
}

export async function createManualVendor(prisma: PrismaClient, raw: unknown) {
  const parsed = vendorInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false as const, error: issue.message, field: String(issue.path[0] ?? "") };
  }
  const v = parsed.data;
  const group = await prisma.group.findUnique({ where: { key: v.groupKey } });
  if (!group) return { ok: false as const, error: "unknown group", field: "groupKey" };
  await prisma.vendor.create({
    data: {
      groupKey: v.groupKey, source: "manual", name: v.name, category: v.category, service: v.service,
      location: v.location, contact: v.contact, recommendedBy: v.recommendedBy, quote: v.quote,
      sentiment: v.sentiment, type: group.vendorMode === "type" ? "recommendation" : null,
      mentions: 1, dates: [new Date().toISOString().slice(0, 10)],
    },
  });
  return { ok: true as const, name: v.name };
}

// Only vendors added on the site can be deleted there; pipeline vendors have no owner to approve it.
export async function deleteManualVendor(prisma: PrismaClient, id: unknown) {
  // Server actions decode arbitrary JSON: an object here would become a Prisma filter matching many rows.
  if (typeof id !== "string" || !id || id.length > 40) return false;
  const r = await prisma.vendor.updateMany({ where: { id, source: "manual", deletedAt: null }, data: { deletedAt: new Date() } });
  return r.count === 1;
}
