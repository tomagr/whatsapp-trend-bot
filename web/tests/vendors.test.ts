import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { createManualVendor, deleteManualVendor } from "@/lib/vendors";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
  await t.prisma.group.createMany({ data: [
    { key: "overland", slug: "overland", name: "O", lang: "es", vendorMode: "sentiment" },
    { key: "members", slug: "members", name: "M", lang: "en", vendorMode: "type" },
  ] });
});
afterAll(async () => { await t.drop(); });
beforeEach(async () => { await t.prisma.vendor.deleteMany(); });

const ok = { groupKey: "overland", name: "  Gomería Sur ", category: "Neumáticos", service: "Cubiertas", sentiment: "mixed" };

test("creates a manual vendor with trimmed fields and today's date", async () => {
  const r = await createManualVendor(t.prisma, ok);
  expect(r).toEqual({ ok: true, name: "Gomería Sur" });
  const v = await t.prisma.vendor.findFirstOrThrow();
  expect(v).toMatchObject({ source: "manual", slug: null, name: "Gomería Sur", sentiment: "mixed", type: null, mentions: 1 });
  expect(v.dates).toEqual([new Date().toISOString().slice(0, 10)]);
});

test("English groups get type recommendation", async () => {
  await createManualVendor(t.prisma, { ...ok, groupKey: "members" });
  expect((await t.prisma.vendor.findFirstOrThrow()).type).toBe("recommendation");
});

test.each([
  [{ ...ok, name: "" }, "name"],
  [{ ...ok, name: "x".repeat(121) }, "name"],
  [{ ...ok, category: "" }, "category"],
  [{ ...ok, quote: "x".repeat(401) }, "quote"],
  [{ ...ok, sentiment: "great" }, "sentiment"],
])("rejects invalid input %#", async (input, field) => {
  const r = await createManualVendor(t.prisma, input);
  expect(r).toMatchObject({ ok: false, field });
  expect(await t.prisma.vendor.count()).toBe(0);
});

test("rejects an unknown group", async () => {
  expect(await createManualVendor(t.prisma, { ...ok, groupKey: "nope" })).toMatchObject({ ok: false });
});

test("soft-deletes a manual vendor", async () => {
  await createManualVendor(t.prisma, ok);
  const v = await t.prisma.vendor.findFirstOrThrow();
  expect(await deleteManualVendor(t.prisma, v.id)).toBe(true);
  expect((await t.prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).deletedAt).not.toBeNull();
});

test("refuses to delete a chat vendor", async () => {
  const v = await t.prisma.vendor.create({ data: { groupKey: "overland", slug: "x", name: "X", source: "chat", dates: [] } });
  expect(await deleteManualVendor(t.prisma, v.id)).toBe(false);
  expect((await t.prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).deletedAt).toBeNull();
});

test("refuses a non-string id (a Prisma filter would match every manual vendor)", async () => {
  await createManualVendor(t.prisma, ok);
  await createManualVendor(t.prisma, { ...ok, name: "Otro" });
  expect(await deleteManualVendor(t.prisma, { not: "" } as unknown as string)).toBe(false);
  expect(await t.prisma.vendor.count({ where: { deletedAt: { not: null } } })).toBe(0);
});
