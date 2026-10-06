import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { renameGroupSlug, resolveSlug, slugError } from "@/lib/slugs";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });
beforeEach(async () => {
  await t.prisma.groupSlugAlias.deleteMany();
  await t.prisma.group.deleteMany();
  await t.prisma.group.createMany({ data: [
    { key: "overland", slug: "overland", name: "O", lang: "es", vendorMode: "sentiment" },
    { key: "members", slug: "members", name: "M", lang: "en", vendorMode: "type" },
  ] });
});

test("validates slug format and reserved paths", () => {
  expect(slugError("overland-ar")).toBeNull();
  for (const bad of ["Overland", "a", "a--b", "-a", "a b", "login", "api", "x".repeat(41)]) expect(slugError(bad)).not.toBeNull();
});

test("renaming keeps the key and redirects the old slug", async () => {
  expect(await renameGroupSlug(t.prisma, "overland", " Overland-AR ")).toEqual({ ok: true, slug: "overland-ar", previous: "overland" });
  expect((await resolveSlug(t.prisma, "overland-ar")).group?.key).toBe("overland");
  expect(await resolveSlug(t.prisma, "overland")).toEqual({ redirectTo: "overland-ar" });
  await renameGroupSlug(t.prisma, "overland", "trucks");
  expect(await resolveSlug(t.prisma, "overland")).toEqual({ redirectTo: "trucks" });
  expect(await resolveSlug(t.prisma, "nope")).toEqual({});
});

test("a group can reclaim its own old slug", async () => {
  await renameGroupSlug(t.prisma, "overland", "trucks");
  expect((await renameGroupSlug(t.prisma, "overland", "overland")).ok).toBe(true);
  expect((await resolveSlug(t.prisma, "overland")).group?.key).toBe("overland");
  expect(await resolveSlug(t.prisma, "trucks")).toEqual({ redirectTo: "overland" });
});

test("rejects slugs used by another group, current or past", async () => {
  expect((await renameGroupSlug(t.prisma, "overland", "members")).ok).toBe(false);
  await renameGroupSlug(t.prisma, "members", "club");
  expect((await renameGroupSlug(t.prisma, "overland", "members")).ok).toBe(false);
  expect((await t.prisma.group.findUniqueOrThrow({ where: { key: "overland" } })).slug).toBe("overland");
});

test("a removed group and its old slugs no longer resolve", async () => {
  await renameGroupSlug(t.prisma, "overland", "trucks");
  await t.prisma.group.update({ where: { key: "overland" }, data: { removedAt: new Date() } });
  expect(await resolveSlug(t.prisma, "trucks")).toEqual({});
  expect(await resolveSlug(t.prisma, "overland")).toEqual({});
});
