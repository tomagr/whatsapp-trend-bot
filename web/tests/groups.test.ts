import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { addGroup, addedGroupsConfig, chatsToOffer, newGroupKey, orderedGroups, removedGroupKeys, removeGroup, restoreGroup, saveChatList, type NewGroup } from "@/lib/groups";
import { copyFor } from "@/lib/groupCopy";
import { nextAccent } from "@/lib/groupStyle";
import { claimNext, finishRun, requestChatList } from "@/lib/updateRuns";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });
beforeEach(async () => {
  await t.prisma.updateRun.deleteMany();
  await t.prisma.waChatList.deleteMany();
  await t.prisma.groupSlugAlias.deleteMany();
  await t.prisma.group.deleteMany();
  await t.prisma.group.createMany({ data: [
    { key: "members", slug: "fittech-club-members", name: "🙋Members", lang: "en", vendorMode: "type" },
    { key: "overland", slug: "argentina-overland-trucks", name: "Argentina Overland Trucks", lang: "es", vendorMode: "sentiment" },
  ] });
});

const form = (over: Partial<NewGroup> = {}): NewGroup => ({
  name: "🏕️ Campers del Sur!", lang: "es", context: "Gente que viaja en motorhome por la Patagonia", vendorMode: "sentiment", scrubChildNames: false, ...over,
});

test("keys come from the WhatsApp name and never collide with keys, slugs or old slugs", async () => {
  expect(await newGroupKey(t.prisma, "🏕️ Campers del Sur!")).toBe("campers-del-sur");
  expect(await newGroupKey(t.prisma, "Fittech Club Members")).toBe("fittech-club-members-2");
  await t.prisma.groupSlugAlias.create({ data: { slug: "padres-3b", groupKey: "overland" } });
  expect(await newGroupKey(t.prisma, "Padres 3B")).toBe("padres-3b-2");
  expect(await newGroupKey(t.prisma, "🎉")).toBe("whatsapp-group");
  expect(await newGroupKey(t.prisma, "Login")).toBe("login-group");
});

test("adding a group stores its config, picks a colour and queues its first run", async () => {
  const r = await addGroup(t.prisma, form(), "a@x.co", new Date("2026-10-06T12:00:00Z"));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.group).toMatchObject({ key: "campers-del-sur", slug: "campers-del-sur", lang: "es", scrubChildNames: false, description: null, addedBy: "a@x.co" });
  expect(r.group.color).toBeTruthy();
  expect(await t.prisma.updateRun.findFirst()).toMatchObject({ groupKey: "campers-del-sur", kind: "update", status: "queued" });
  expect(await addedGroupsConfig(t.prisma)).toEqual([{
    key: "campers-del-sur", name: "🏕️ Campers del Sur!", lang: "es", vendor_mode: "sentiment",
    context: "Gente que viaja en motorhome por la Patagonia", privacy: { scrub_child_names: false }, added: true,
  }]);
});

test("a group whose chat mentions children scrubs their names and keeps its photo off the page", async () => {
  const r = await addGroup(t.prisma, form({ name: "Padres 2B", scrubChildNames: true }), "a@x.co");
  expect(r.ok && r.group.scrubChildNames).toBe(true);
  expect((await addedGroupsConfig(t.prisma)).find((c) => c.name === "Padres 2B")?.privacy).toEqual({ scrub_child_names: true });
  await removeGroup(t.prisma, r.ok ? r.group.key : "", "a@x.co");
  const again = await addGroup(t.prisma, form({ name: "Padres 2B", scrubChildNames: false }), "a@x.co");
  expect(again.ok && again.group.scrubChildNames).toBe(false); // re-adding takes the new answer
});

test("the same WhatsApp group cannot be added twice, and the form is checked", async () => {
  expect((await addGroup(t.prisma, form({ name: "Argentina Overland Trucks" }), "a@x.co")).ok).toBe(false);
  expect((await addGroup(t.prisma, form({ context: "short" }), "a@x.co")).ok).toBe(false);
  expect((await addGroup(t.prisma, form({ lang: "fr" }), "a@x.co")).ok).toBe(false);
});

test("type-mode groups get the vendor types the model expects", async () => {
  await addGroup(t.prisma, form({ name: "Founders", lang: "en", vendorMode: "type" }), "a@x.co");
  expect((await addedGroupsConfig(t.prisma))[0]).toMatchObject({ vendor_mode: "type", vendor_types: ["recommendation", "self-promotion"] });
});

test("built-in groups come first in their fixed order, added ones after by date", async () => {
  await addGroup(t.prisma, form({ name: "B group" }), "a@x.co", new Date("2026-10-02"));
  await addGroup(t.prisma, form({ name: "A group" }), "a@x.co", new Date("2026-10-01"));
  expect((await orderedGroups(t.prisma)).map((g) => g.key)).toEqual(["overland", "members", "a-group", "b-group"]);
});

test("the picker offers the newest chats that are not on the platform yet", async () => {
  expect(await chatsToOffer(t.prisma)).toBeNull();
  await saveChatList(t.prisma, [
    { id: "1@g.us", name: "Old", t: 100 }, { id: "2@g.us", name: "Argentina Overland Trucks", t: 900 },
    { id: "3@g.us", name: "New", t: 500 }, { id: "4@g.us", name: "", t: 999 },
  ]);
  expect((await chatsToOffer(t.prisma))!.chats.map((c) => c.name)).toEqual(["New", "Old"]);
  await saveChatList(t.prisma, [{ id: "5@g.us", name: "Archived one", t: 50, archived: true }]);
  expect((await chatsToOffer(t.prisma))!.chats).toEqual([{ id: "5@g.us", name: "Archived one", t: 50, archived: true }]);
});

test("one chat-list request at a time, and it is not swept up by an update run", async () => {
  const a = await requestChatList(t.prisma, "a@x.co");
  expect((await requestChatList(t.prisma, "b@x.co")).id).toBe(a.id);
  const upd = await t.prisma.updateRun.create({ data: { requestedBy: "c@x.co", requestedAt: new Date(Date.now() - 60_000) } });
  const claimed = await claimNext(t.prisma);
  expect(claimed?.id).toBe(upd.id);
  await finishRun(t.prisma, upd.id, "done", "ok");
  expect(await t.prisma.updateRun.findUnique({ where: { id: a.id } })).toMatchObject({ status: "queued" });
});

test("added groups get template copy in their language; built-in groups keep theirs", () => {
  const es = copyFor({ key: "campers", name: "Campers", lang: "es", vendorMode: "sentiment", addedAt: "2026-10-06" });
  expect(es.h1).toEqual(["Recomendaciones de ", "Campers"]);
  expect(es.indexMeta).toBe("ES · added oct 2026");
  expect(es.filters[0][0]).toBe("positive");
  const en = copyFor({ key: "f", name: "Founders", lang: "en", vendorMode: "type", description: "Startup founders" });
  expect(en.lede).toBe("Startup founders");
  expect(en.filters[0][0]).toBe("recommendation");
  expect(copyFor({ key: "overland", name: "x", lang: "es", vendorMode: "sentiment" }).eyebrowName).toBe("Argentina Overland Trucks");
});

test("colours rotate so added groups look different", () => {
  expect(nextAccent([])).toBe("rust");
  expect(nextAccent(["rust"])).not.toBe("rust");
});

test("removing hides a group everywhere and tells the pipeline to skip it; restoring brings it back", async () => {
  const r = await addGroup(t.prisma, form(), "a@x.co");
  if (!r.ok) throw new Error(r.error);
  expect(await removeGroup(t.prisma, "campers-del-sur", "b@x.co")).toBe(true);
  expect(await removeGroup(t.prisma, "overland", "b@x.co")).toBe(true);
  expect((await orderedGroups(t.prisma)).map((g) => g.key)).toEqual(["members"]);
  expect(await addedGroupsConfig(t.prisma)).toEqual([]);
  expect((await removedGroupKeys(t.prisma)).sort()).toEqual(["campers-del-sur", "overland"]);
  // A removed group's queued run is canceled, so the Mac does not process it.
  expect(await t.prisma.updateRun.findFirst({ where: { groupKey: "campers-del-sur" } })).toMatchObject({ status: "canceled" });
  expect(await restoreGroup(t.prisma, "overland")).toBe(true);
  expect((await orderedGroups(t.prisma)).map((g) => g.key)).toEqual(["overland", "members"]);
});

test("a removed group reappears in the picker, and adding it again restores the same page", async () => {
  await addGroup(t.prisma, form(), "a@x.co");
  await removeGroup(t.prisma, "campers-del-sur", "a@x.co");
  await saveChatList(t.prisma, [{ id: "9@g.us", name: "🏕️ Campers del Sur!", t: 10 }]);
  expect((await chatsToOffer(t.prisma))!.chats).toHaveLength(1);
  const again = await addGroup(t.prisma, form({ lang: "en", context: "Motorhome travellers in Patagonia" }), "c@x.co");
  expect(again).toMatchObject({ ok: true, group: { key: "campers-del-sur", lang: "en", removedAt: null } });
  expect(await t.prisma.group.count({ where: { name: "🏕️ Campers del Sur!" } })).toBe(1);
});
