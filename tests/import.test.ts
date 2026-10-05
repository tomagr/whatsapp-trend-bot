import { afterAll, beforeAll, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { importGroup } from "@/lib/importArtifacts";
import { syncGroup, type Snapshot } from "@/lib/sync";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });

const snap: Snapshot = {
  group: { key: "overland", name: "O", lang: "es", vendorMode: "sentiment", checkedAt: null, messagesThrough: null },
  vendors: { kept: { name: "Kept" }, gone: { name: "Gone" } },
  opportunities: {},
};

test("imports manual vendors and carries deletions over, idempotently", async () => {
  const docs = [
    { id: "kept", name: "Kept", source: "chat" },
    { id: "abc", name: "Mine", category: "X", source: "manual", createdAt: 1759600000000, sentiment: "positive", dates: ["2026-10-01"] },
  ];
  for (let i = 0; i < 2; i++) {
    expect(await importGroup(t.prisma, "overland", docs, ["kept", "gone"], snap)).toEqual({ manual: 1, deleted: 1 });
  }
  expect(await t.prisma.vendor.count({ where: { source: "manual" } })).toBe(1);
  const mine = await t.prisma.vendor.findFirstOrThrow({ where: { source: "manual" } });
  expect(mine.createdAt.getTime()).toBe(1759600000000);
  await syncGroup(t.prisma, snap);
  expect((await t.prisma.vendor.findFirstOrThrow({ where: { slug: "gone" } })).deletedAt).not.toBeNull();
  expect((await t.prisma.vendor.findFirstOrThrow({ where: { slug: "kept" } })).deletedAt).toBeNull();
});
