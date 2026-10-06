import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { activeRun, cancelRun, claimNext, finishRun, requestRun, STALE_MS, statusFromCode } from "@/lib/updateRuns";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });
beforeEach(async () => { await t.prisma.updateRun.deleteMany(); });

const at = (min: number) => new Date(Date.UTC(2026, 9, 6, 12, min));

test("only one request can be queued or running at a time", async () => {
  const a = await requestRun(t.prisma, "a@x.co", at(0));
  expect(a.ok).toBe(true);
  const b = await requestRun(t.prisma, "b@x.co", at(1));
  expect(b).toMatchObject({ ok: false, run: { id: a.run.id } });
  await claimNext(t.prisma, at(2));
  expect((await requestRun(t.prisma, "b@x.co", at(3))).ok).toBe(false);
  await finishRun(t.prisma, a.run.id, "done", "ok", at(30));
  expect((await requestRun(t.prisma, "b@x.co", at(31))).ok).toBe(true);
});

test("the poller claims the oldest queued request once", async () => {
  const { run } = await requestRun(t.prisma, "a@x.co", at(0));
  const claimed = await claimNext(t.prisma, at(1));
  expect(claimed).toMatchObject({ id: run.id, status: "running" });
  expect(await claimNext(t.prisma, at(2))).toBeNull();
});

test("canceling works only before the Mac picks the request up", async () => {
  const { run } = await requestRun(t.prisma, "a@x.co", at(0));
  expect(await cancelRun(t.prisma, run.id, at(1))).toBe(true);
  expect(await claimNext(t.prisma, at(2))).toBeNull();
  const { run: r2 } = await requestRun(t.prisma, "a@x.co", at(3));
  await claimNext(t.prisma, at(4));
  expect(await cancelRun(t.prisma, r2.id, at(5))).toBe(false);
});

test("a run with no result for too long stops blocking and is marked failed", async () => {
  const { run } = await requestRun(t.prisma, "a@x.co", at(0));
  await claimNext(t.prisma, at(1));
  const later = new Date(at(1).getTime() + STALE_MS + 60_000);
  expect(await activeRun(t.prisma, later)).toBeNull();
  await claimNext(t.prisma, later);
  expect(await t.prisma.updateRun.findUnique({ where: { id: run.id } })).toMatchObject({ status: "failed" });
});

test("requests queued while a run was starting share its outcome", async () => {
  const { run } = await requestRun(t.prisma, "a@x.co", at(0));
  await claimNext(t.prisma, at(5));
  // A request that slipped in before the claim (e.g. a double click racing the check).
  const early = await t.prisma.updateRun.create({ data: { requestedBy: "b@x.co", requestedAt: at(4) } });
  const late = await t.prisma.updateRun.create({ data: { requestedBy: "c@x.co", requestedAt: at(10) } });
  await finishRun(t.prisma, run.id, "review", "members: failed", at(20));
  expect(await t.prisma.updateRun.findUnique({ where: { id: early.id } })).toMatchObject({ status: "review", message: "members: failed" });
  expect(await t.prisma.updateRun.findUnique({ where: { id: late.id } })).toMatchObject({ status: "queued" });
});

test("a request can name one group, and it blocks other requests while active", async () => {
  const { run } = await requestRun(t.prisma, "a@x.co", at(0), "members");
  expect(run.groupKey).toBe("members");
  expect((await requestRun(t.prisma, "b@x.co", at(1))).ok).toBe(false);
  expect((await claimNext(t.prisma, at(2)))?.groupKey).toBe("members");
});

test("a single-group run only covers queued requests for that same group", async () => {
  const { run } = await requestRun(t.prisma, "a@x.co", at(0), "members");
  await claimNext(t.prisma, at(5));
  const sameGroup = await t.prisma.updateRun.create({ data: { requestedBy: "b@x.co", requestedAt: at(4), groupKey: "members" } });
  const allGroups = await t.prisma.updateRun.create({ data: { requestedBy: "c@x.co", requestedAt: at(4) } });
  await finishRun(t.prisma, run.id, "done", "members: 3 msgs", at(20));
  expect(await t.prisma.updateRun.findUnique({ where: { id: sameGroup.id } })).toMatchObject({ status: "done" });
  expect(await t.prisma.updateRun.findUnique({ where: { id: allGroups.id } })).toMatchObject({ status: "queued" });
});

test("maps the weekly script's exit codes", () => {
  expect([0, 2, 3, 1, 142].map(statusFromCode)).toEqual(["done", "review", "failed", "failed", "failed"]);
});
