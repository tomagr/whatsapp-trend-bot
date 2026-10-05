// One-time import of what people did on the claude.ai artifact pages: vendors they added, and vendors deleted there.
import type { PrismaClient } from "./generated/prisma/client";
import { upsertGroup, type Snapshot } from "./sync";

export type ArtifactDoc = { id: string } & Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function importGroup(prisma: PrismaClient, key: string, docs: ArtifactDoc[], publishedSlugs: string[], snap: Snapshot) {
  await upsertGroup(prisma, snap.group);
  let manual = 0, deleted = 0;
  for (const d of docs.filter((x) => x.source === "manual")) {
    const createdAt = typeof d.createdAt === "number" ? new Date(d.createdAt) : new Date();
    const exists = await prisma.vendor.findFirst({ where: { groupKey: key, source: "manual", name: str(d.name), createdAt } });
    if (!exists) {
      await prisma.vendor.create({ data: {
        groupKey: key, source: "manual", createdAt, name: str(d.name), category: str(d.category), service: str(d.service),
        location: str(d.location), contact: str(d.contact), recommendedBy: str(d.recommendedBy), quote: str(d.quote), note: str(d.note),
        mentions: typeof d.mentions === "number" ? d.mentions : 1, sentiment: str(d.sentiment) || null, type: str(d.type) || null,
        dates: Array.isArray(d.dates) ? d.dates.map(String) : [],
      } });
    }
    manual++;
  }
  // Published by the pipeline but gone from the page: someone deleted it there.
  const onPage = new Set(docs.map((d) => d.id));
  for (const slug of publishedSlugs.filter((s) => !onPage.has(s))) {
    await prisma.vendor.upsert({
      where: { groupKey_slug: { groupKey: key, slug } },
      create: { groupKey: key, slug, source: "chat", name: snap.vendors[slug]?.name ?? slug, dates: [], deletedAt: new Date() },
      update: { deletedAt: new Date() },
    });
    deleted++;
  }
  return { manual, deleted };
}
