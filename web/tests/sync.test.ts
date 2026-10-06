import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { runSync, syncGroup, type Snapshot } from "@/lib/sync";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });
beforeEach(async () => {
  await t.prisma.opportunity.deleteMany();
  await t.prisma.vendor.deleteMany();
  await t.prisma.group.deleteMany();
});

const vendor = (name: string, extra: Record<string, unknown> = {}) => ({
  name, category: "Repuestos", service: "s", location: "", contact: "", recommendedBy: "Sergio",
  mentions: 1, sentiment: "positive", dates: ["2026-07-22"], note: "", quote: "q", source: "chat", ...extra,
});
const opp = (rank: number, title: string) => ({
  rank, title, summary: "", offer: "", alternatives: "", gap: "open", signals: 3, people: 2,
  firstDate: "2026-03-31", lastDate: "2026-09-01", quotes: [{ date: "2026-04-01", who: "A", text: "t" }],
});
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  group: { key: "overland", name: "Argentina Overland Trucks", lang: "es", vendorMode: "sentiment", checkedAt: "2026-10-05", messagesThrough: "2026-10-05" },
  vendors: { "taller-a": vendor("Taller A") },
  opportunities: { "opp-01": opp(1, "Repuestos") },
  ...over,
});

test("inserts group, vendors and opportunities", async () => {
  const r = await syncGroup(t.prisma, snap());
  expect(r).toEqual({ key: "overland", upserted: 1, skippedDeleted: 0, opportunities: 1 });
  const v = await t.prisma.vendor.findFirstOrThrow({ where: { slug: "taller-a" } });
  expect(v).toMatchObject({ name: "Taller A", source: "chat", groupKey: "overland", dates: ["2026-07-22"] });
  expect((await t.prisma.group.findUniqueOrThrow({ where: { key: "overland" } })).messagesThrough).toBe("2026-10-05");
});

test("updates an existing vendor in place", async () => {
  await syncGroup(t.prisma, snap());
  await syncGroup(t.prisma, snap({ vendors: { "taller-a": vendor("Taller A", { mentions: 4 }) } }));
  const all = await t.prisma.vendor.findMany();
  expect(all).toHaveLength(1);
  expect(all[0].mentions).toBe(4);
});

test("keeps a deleted vendor deleted", async () => {
  await syncGroup(t.prisma, snap());
  await t.prisma.vendor.updateMany({ where: { slug: "taller-a" }, data: { deletedAt: new Date() } });
  const r = await syncGroup(t.prisma, snap({ vendors: { "taller-a": vendor("Taller A", { mentions: 9 }) } }));
  expect(r.skippedDeleted).toBe(1);
  const v = await t.prisma.vendor.findFirstOrThrow({ where: { slug: "taller-a" } });
  expect(v.deletedAt).not.toBeNull();
  expect(v.mentions).toBe(1);
});

test("leaves manual vendors untouched", async () => {
  await syncGroup(t.prisma, snap());
  const m = await t.prisma.vendor.create({ data: { groupKey: "overland", name: "Mío", category: "X", source: "manual", dates: [] } });
  await syncGroup(t.prisma, snap({ vendors: {} }));
  expect(await t.prisma.vendor.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({ name: "Mío", deletedAt: null });
});

test("replaces opportunities as a set", async () => {
  await syncGroup(t.prisma, snap({ opportunities: { "opp-01": opp(1, "A"), "opp-02": opp(2, "B") } }));
  await syncGroup(t.prisma, snap({ opportunities: { "opp-01": opp(1, "C") } }));
  const opps = await t.prisma.opportunity.findMany();
  expect(opps.map((o) => o.title)).toEqual(["C"]);
});

test("running twice gives the same result", async () => {
  await syncGroup(t.prisma, snap());
  const before = await t.prisma.vendor.findMany({ select: { slug: true, name: true, mentions: true } });
  const r = await syncGroup(t.prisma, snap());
  expect(r.upserted).toBe(1);
  expect(await t.prisma.vendor.findMany({ select: { slug: true, name: true, mentions: true } })).toEqual(before);
});

test("runSync continues past a broken group", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "state-"));
  fs.mkdirSync(path.join(dir, "overland"));
  fs.writeFileSync(path.join(dir, "overland", "site.json"), JSON.stringify(snap()));
  fs.mkdirSync(path.join(dir, "moves"));
  fs.writeFileSync(path.join(dir, "moves", "site.json"), "{not json");
  const out = await runSync(t.prisma, dir);
  expect(out.results.map((r) => r.key)).toEqual(["overland"]);
  expect(out.failed.map((f) => f.key)).toEqual(["moves"]);
});

test("runSync stores the group photo from the state folder and clears it when the snapshot drops it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-photo-"));
  fs.mkdirSync(path.join(dir, "overland"));
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  fs.writeFileSync(path.join(dir, "overland", "photo.jpg"), bytes);
  const write = (photo: unknown) => fs.writeFileSync(path.join(dir, "overland", "site.json"),
    JSON.stringify({ ...snap(), group: { ...snap().group, ...(photo === undefined ? {} : { photo }) } }));

  write({ file: "photo.jpg", type: "image/jpeg", sha256: "abc" });
  await runSync(t.prisma, dir);
  let g = await t.prisma.group.findUnique({ where: { key: "overland" } });
  expect(Buffer.from(g!.photo!)).toEqual(bytes);
  expect(g).toMatchObject({ photoType: "image/jpeg", photoHash: "abc" });

  write(undefined); // older snapshots without the field leave the photo alone
  await runSync(t.prisma, dir);
  expect((await t.prisma.group.findUnique({ where: { key: "overland" } }))!.photoHash).toBe("abc");

  write(null); // the group has no photo (or must not publish one): clear it
  await runSync(t.prisma, dir);
  g = await t.prisma.group.findUnique({ where: { key: "overland" } });
  expect(g).toMatchObject({ photo: null, photoType: null, photoHash: null });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("a photo file outside the group folder is never read", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-photo-"));
  fs.mkdirSync(path.join(dir, "overland"));
  fs.writeFileSync(path.join(dir, "overland", "site.json"),
    JSON.stringify({ ...snap(), group: { ...snap().group, photo: { file: "../secret.jpg", type: "image/jpeg", sha256: "x" } } }));
  const out = await runSync(t.prisma, dir);
  expect(out.failed[0]).toMatchObject({ key: "overland" });
  fs.rmSync(dir, { recursive: true, force: true });
});
