import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "./generated/prisma/client";

export type GroupInfo = {
  key: string; name: string; lang: string; vendorMode: string;
  checkedAt: string | null; messagesThrough: string | null;
  // The WhatsApp group photo in the group's state folder. Missing: leave the stored photo; null: clear it.
  photo?: { file: string; type: string; sha256: string } | null;
  // Groups added from /admin: the page description Claude wrote (null until there are vendors; missing: leave it),
  // and what the group is about when Claude inferred it because the form was left empty (missing otherwise).
  description?: string | null;
  context?: string | null;
};
export type Photo = { data: Uint8Array<ArrayBuffer>; type: string; hash: string } | null;
export type VendorDoc = {
  name: string; category?: string; service?: string; location?: string; contact?: string;
  recommendedBy?: string; note?: string; quote?: string; mentions?: number;
  sentiment?: string; type?: string; dates?: string[];
};
export type OpportunityDoc = {
  rank: number; title: string; summary?: string; offer?: string; alternatives?: string; gap?: string;
  signals?: number; people?: number; firstDate?: string; lastDate?: string;
  quotes?: { date?: string; who?: string; text?: string }[];
};
export type Snapshot = { group: GroupInfo; vendors: Record<string, VendorDoc>; opportunities: Record<string, OpportunityDoc> };
export type SyncResult = { key: string; upserted: number; skippedDeleted: number; opportunities: number };

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const SENTIMENTS = new Set(["positive", "mixed", "negative"]);
const TYPES = new Set(["recommendation", "self-promotion", "featured"]);

function vendorFields(d: VendorDoc) {
  return {
    name: d.name,
    category: d.category ?? "",
    service: d.service ?? "",
    location: d.location ?? "",
    contact: d.contact ?? "",
    recommendedBy: d.recommendedBy ?? "",
    note: d.note ?? "",
    quote: d.quote ?? "",
    mentions: d.mentions ?? 1,
    sentiment: d.sentiment && SENTIMENTS.has(d.sentiment) ? d.sentiment : null,
    type: d.type && TYPES.has(d.type) ? d.type : null,
    dates: d.dates ?? [],
  };
}

export async function upsertGroup(tx: Tx, g: GroupInfo, photo?: Photo) {
  const data = {
    name: g.name, lang: g.lang, vendorMode: g.vendorMode, checkedAt: g.checkedAt, messagesThrough: g.messagesThrough,
    ...(g.description ? { description: g.description } : {}),
    ...(g.context ? { context: g.context } : {}),
    ...(photo === undefined ? {} : photo ? { photo: photo.data, photoType: photo.type, photoHash: photo.hash } : { photo: null, photoType: null, photoHash: null }),
  };
  await tx.group.upsert({ where: { key: g.key }, create: { key: g.key, slug: g.key, ...data }, update: data });
}

// Copies one group's full snapshot into the database. Manual vendors and site deletions always win.
export async function syncGroup(prisma: PrismaClient, snap: Snapshot, photo?: Photo): Promise<SyncResult> {
  const key = snap.group.key;
  return prisma.$transaction(async (tx) => {
    await upsertGroup(tx, snap.group, photo);
    const deleted = new Set(
      (await tx.vendor.findMany({ where: { groupKey: key, slug: { not: null }, deletedAt: { not: null } }, select: { slug: true } }))
        .map((v) => v.slug),
    );
    let upserted = 0, skippedDeleted = 0;
    for (const [slug, doc] of Object.entries(snap.vendors)) {
      if (deleted.has(slug)) { skippedDeleted++; continue; }
      const data = vendorFields(doc);
      await tx.vendor.upsert({
        where: { groupKey_slug: { groupKey: key, slug } },
        create: { groupKey: key, slug, source: "chat", ...data },
        update: data, // never touches deletedAt or source
      });
      upserted++;
    }
    await tx.opportunity.deleteMany({ where: { groupKey: key } });
    const opps = Object.entries(snap.opportunities).map(([k, o]) => ({
      groupKey: key, key: k, rank: o.rank, title: o.title, summary: o.summary ?? "", offer: o.offer ?? "",
      alternatives: o.alternatives ?? "", gap: o.gap ?? "open", signals: o.signals ?? 0, people: o.people ?? 0,
      firstDate: o.firstDate ?? "", lastDate: o.lastDate ?? "", quotes: o.quotes ?? [],
    }));
    if (opps.length) await tx.opportunity.createMany({ data: opps });
    return { key, upserted, skippedDeleted, opportunities: opps.length };
  }, { timeout: 120_000, maxWait: 30_000 });
}

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function readPhoto(dir: string, p: GroupInfo["photo"]): Photo | undefined {
  if (p === undefined) return undefined;
  if (p === null) return null;
  // Only a plain file name inside the group's own folder, and only image types the site serves.
  if (!/^[\w.-]+$/.test(p.file) || p.file.startsWith(".")) throw new Error(`invalid photo file ${JSON.stringify(p.file)}`);
  if (!PHOTO_TYPES.has(p.type)) throw new Error(`unsupported photo type ${p.type}`);
  return { data: new Uint8Array(fs.readFileSync(path.join(dir, p.file))), type: p.type, hash: p.sha256 };
}

export async function runSync(prisma: PrismaClient, stateDir: string) {
  const results: SyncResult[] = [];
  const failed: { key: string; error: string }[] = [];
  const keys = fs.readdirSync(stateDir).filter((k) => fs.existsSync(path.join(stateDir, k, "site.json"))).sort();
  for (const key of keys) {
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(stateDir, key, "site.json"), "utf8")) as Snapshot;
      if (snap.group?.key !== key) throw new Error(`site.json group key ${snap.group?.key} does not match folder ${key}`);
      results.push(await syncGroup(prisma, snap, readPhoto(path.join(stateDir, key), snap.group.photo)));
    } catch (e) {
      failed.push({ key, error: String((e as Error).message ?? e).slice(0, 500) });
    }
  }
  return { results, failed };
}
