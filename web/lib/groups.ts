import type { PrismaClient } from "./generated/prisma/client";
import { GROUP_KEYS } from "./groupCopy";
import { nextAccent } from "./groupStyle";
import { stripEmoji } from "./ogImage";
import { slugError } from "./slugs";

// Every group the site shows: the original five in their fixed order, then added ones, oldest first. No photo bytes.
// removed: true lists the removed ones instead (for "Restore" in /admin).
export async function orderedGroups(prisma: PrismaClient, { removed = false } = {}) {
  const rows = await prisma.group.findMany({ where: { removedAt: removed ? { not: null } : null }, omit: { photo: true } });
  const builtIn = (k: string) => (GROUP_KEYS as string[]).indexOf(k);
  return rows.sort((a, b) => {
    const ia = builtIn(a.key), ib = builtIn(b.key);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return (a.addedAt?.getTime() ?? 0) - (b.addedAt?.getTime() ?? 0);
  });
}

// "🏃‍♀️ Fittech Club: Moves!" -> "fittech-club-moves"; numbered when taken, by a group key, a slug or an old slug.
export async function newGroupKey(prisma: PrismaClient, name: string) {
  const base = stripEmoji(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36).replace(/-+$/, "");
  const stem = base.length >= 2 && !slugError(base) ? base : `${base || "whatsapp"}-group`;
  for (let n = 1; ; n++) {
    const key = n === 1 ? stem : `${stem}-${n}`;
    const taken = await prisma.group.findFirst({ where: { OR: [{ key }, { slug: key }] }, select: { key: true } })
      ?? await prisma.groupSlugAlias.findUnique({ where: { slug: key } });
    if (!taken) return key;
  }
}

// The page description is written by Claude after the first run (trendbot describe). Names are not scrubbed per
// group: logged-out visitors never see members' names or quotes (forVisitor in lib/vendors.ts); scrubChildNames
// stays in the schema for groups added before that and for trendbot's photo_allowed.
export type NewGroup = { name: string; lang: string; context: string; vendorMode: string };

export function newGroupError(g: NewGroup): string | null {
  if (!g.name.trim()) return "Pick a WhatsApp group.";
  if (g.lang !== "es" && g.lang !== "en") return "Choose a language.";
  if (g.vendorMode !== "sentiment" && g.vendorMode !== "type") return "Choose what kind of group it is.";
  if (g.context.trim().length < 10) return "Describe what the group is about in a sentence.";
  if (g.context.length > 600) return "Keep the description short.";
  return null;
}

// Adds the group and queues its first update, which runs after anything already queued (the Mac does one at a time).
// Adding a group that was removed brings back the same page (key, slug and data) with the new settings.
export async function addGroup(prisma: PrismaClient, g: NewGroup, email: string, now = new Date()) {
  const err = newGroupError(g);
  if (err) return { ok: false as const, error: err };
  const existing = await prisma.group.findFirst({ where: { name: g.name }, omit: { photo: true } });
  if (existing && !existing.removedAt) return { ok: false as const, error: "That group is already on the platform." };
  const config = {
    lang: g.lang, vendorMode: g.vendorMode, context: g.context.trim(),
    vendorTypes: g.vendorMode === "type" ? ["recommendation", "self-promotion"] : [],
  };
  let group;
  if (existing) {
    group = await prisma.group.update({ where: { key: existing.key }, omit: { photo: true }, data: { ...config, removedAt: null, removedBy: null } });
  } else {
    const key = await newGroupKey(prisma, g.name);
    const used = (await prisma.group.findMany({ where: { addedAt: { not: null } }, select: { color: true } })).map((r) => r.color);
    group = await prisma.group.create({
      omit: { photo: true },
      data: { key, slug: key, name: g.name, ...config, addedAt: now, addedBy: email, color: nextAccent(used) },
    });
  }
  const key = group.key;
  await prisma.updateRun.create({ data: { requestedBy: email, requestedAt: now, groupKey: key } });
  return { ok: true as const, group };
}

// Pipeline config (the shape of groups.json) for the groups added from /admin; the poller writes it for the Mac.
export async function addedGroupsConfig(prisma: PrismaClient) {
  const rows = await prisma.group.findMany({ where: { addedAt: { not: null }, removedAt: null }, orderBy: { addedAt: "asc" }, omit: { photo: true } });
  return rows.map((g) => ({
    key: g.key, name: g.name, lang: g.lang, vendor_mode: g.vendorMode, context: g.context ?? "",
    ...(g.vendorTypes.length ? { vendor_types: g.vendorTypes } : {}),
    privacy: { scrub_child_names: g.scrubChildNames },
    added: true, // the pipeline writes a page description for these (trendbot describe)
  }));
}

// Keys the pipeline must skip, built-in ones included; the poller writes them next to the added groups.
export async function removedGroupKeys(prisma: PrismaClient) {
  return (await prisma.group.findMany({ where: { removedAt: { not: null } }, select: { key: true } })).map((g) => g.key);
}

// Takes the page offline and stops the Mac from processing the group. Nothing is deleted, so it can be restored.
export async function removeGroup(prisma: PrismaClient, key: string, email: string, now = new Date()) {
  const { count } = await prisma.group.updateMany({ where: { key, removedAt: null }, data: { removedAt: now, removedBy: email } });
  if (count) {
    await prisma.updateRun.updateMany({ where: { groupKey: key, status: "queued" }, data: { status: "canceled", finishedAt: now, message: "Group removed." } });
  }
  return count === 1;
}

export async function restoreGroup(prisma: PrismaClient, key: string) {
  const { count } = await prisma.group.updateMany({ where: { key, removedAt: { not: null } }, data: { removedAt: null, removedBy: null } });
  return count === 1;
}

export type WaChat = { id: string; name: string; t: number; archived?: boolean };

export async function saveChatList(prisma: PrismaClient, chats: WaChat[], now = new Date()) {
  const clean = chats.filter((c) => c && typeof c.name === "string" && c.name.trim())
    .map((c) => ({ id: String(c.id), name: c.name, t: Number(c.t) || 0, archived: !!c.archived }))
    .sort((a, b) => b.t - a.t);
  await prisma.waChatList.upsert({ where: { id: "latest" }, create: { chats: clean, fetchedAt: now }, update: { chats: clean, fetchedAt: now } });
  return clean;
}

// What the picker offers: groups not on the platform yet, newest activity first.
export async function chatsToOffer(prisma: PrismaClient) {
  const [list, groups] = await Promise.all([
    prisma.waChatList.findUnique({ where: { id: "latest" } }),
    prisma.group.findMany({ where: { removedAt: null }, select: { name: true } }),
  ]);
  if (!list) return null;
  const have = new Set(groups.map((g) => g.name));
  return { fetchedAt: list.fetchedAt, chats: (list.chats as WaChat[]).filter((c) => !have.has(c.name)) };
}
