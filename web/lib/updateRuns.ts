import type { PrismaClient } from "./generated/prisma/client";

// The weekly script caps itself at about 75 minutes (preflight + run + sync + summary). A run still "running"
// after this long means the Mac went to sleep or the poller died, so it no longer blocks new requests.
export const STALE_MS = 2 * 60 * 60 * 1000;

export type RunStatus = "queued" | "running" | "done" | "review" | "failed" | "canceled";

const isStale = (r: { status: string; startedAt: Date | null }, now: Date) =>
  r.status === "running" && !!r.startedAt && now.getTime() - r.startedAt.getTime() > STALE_MS;

// The queued or running request, if any. Only one at a time, even for single groups: each run opens WhatsApp Web.
export async function activeRun(prisma: PrismaClient, now = new Date()) {
  const r = await prisma.updateRun.findFirst({ where: { status: { in: ["queued", "running"] } }, orderBy: { requestedAt: "desc" } });
  return r && !isStale(r, now) ? r : null;
}

// groupKey limits the run to one group; null runs every group, like the Monday job.
export async function requestRun(prisma: PrismaClient, email: string, now = new Date(), groupKey: string | null = null) {
  const active = await activeRun(prisma, now);
  if (active) return { ok: false as const, run: active };
  return { ok: true as const, run: await prisma.updateRun.create({ data: { requestedBy: email, requestedAt: now, groupKey } }) };
}

// Only a request the Mac has not picked up yet can be canceled.
export async function cancelRun(prisma: PrismaClient, id: string, now = new Date()) {
  const { count } = await prisma.updateRun.updateMany({ where: { id, status: "queued" }, data: { status: "canceled", finishedAt: now } });
  return count === 1;
}

// Poller side: give up on stale runs, then take the oldest queued request. updateMany on (id, status) makes the
// claim atomic, so two pollers never start the same request.
export async function claimNext(prisma: PrismaClient, now = new Date()) {
  await prisma.updateRun.updateMany({
    where: { status: "running", startedAt: { lt: new Date(now.getTime() - STALE_MS) } },
    data: { status: "failed", finishedAt: now, message: "The Mac never reported a result (it may have gone to sleep)." },
  });
  const next = await prisma.updateRun.findFirst({ where: { status: "queued" }, orderBy: { requestedAt: "asc" } });
  if (!next) return null;
  const { count } = await prisma.updateRun.updateMany({ where: { id: next.id, status: "queued" }, data: { status: "running", startedAt: now } });
  return count === 1 ? { ...next, status: "running", startedAt: now } : null;
}

// Requests queued while this one was starting are covered by it, so they get the same outcome:
// a full run covers any of them, a single-group run only those for its group.
export async function finishRun(prisma: PrismaClient, id: string, status: Exclude<RunStatus, "queued" | "running" | "canceled">, message: string, now = new Date()) {
  const run = await prisma.updateRun.update({ where: { id }, data: { status, message, finishedAt: now } });
  await prisma.updateRun.updateMany({
    where: { status: "queued", kind: run.kind, requestedAt: { lte: run.startedAt ?? now }, ...(run.groupKey ? { groupKey: run.groupKey } : {}) },
    data: { status, message, startedAt: run.startedAt, finishedAt: now },
  });
  return run;
}

// "Add group" needs the Mac's current list of WhatsApp groups; one request at a time, reused while it is pending.
export async function requestChatList(prisma: PrismaClient, email: string, now = new Date()) {
  const pending = await prisma.updateRun.findFirst({ where: { kind: "list-chats", status: { in: ["queued", "running"] } }, orderBy: { requestedAt: "desc" } });
  if (pending && !isStale(pending, now)) return pending;
  return prisma.updateRun.create({ data: { requestedBy: email, requestedAt: now, kind: "list-chats" } });
}

export function recentRuns(prisma: PrismaClient, take = 10) {
  return prisma.updateRun.findMany({ orderBy: { requestedAt: "desc" }, take });
}

// run_weekly.sh records the same exit codes as `trendbot summary`: 0 ok, 2 a group needs a look, anything else failed.
export function statusFromCode(code: number): "done" | "review" | "failed" {
  return code === 0 ? "done" : code === 2 ? "review" : "failed";
}
