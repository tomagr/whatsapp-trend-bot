// Runs on the Mac every minute (launchd/com.whatsapptrendbot.poll.plist) and does what /admin asked for:
// - mirrors the groups added in /admin to state/groups-added.json, where the pipeline picks them up;
// - an "update" request runs the weekly job through the launcher app and records the outcome;
// - a "list-chats" request reads the Mac's WhatsApp groups for the "Add group" picker.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { makePrisma } from "../lib/db";
import { addedGroupsConfig, removedGroupKeys, saveChatList, type WaChat } from "../lib/groups";
import { claimNext, finishRun, statusFromCode } from "../lib/updateRuns";

const ROOT = path.join(import.meta.dirname, "..", "..");
config({ path: path.join(ROOT, ".env"), quiet: true });

// Same app the Monday job opens, so the run gets the app's Full Disk Access.
const APP = path.join(ROOT, "app", "WhatsApp Trend Bot.app");
const RESULT = path.join(ROOT, "logs", "last-result.json");
const LOCK = path.join(ROOT, "logs", "run.lock");
// Read once by run_weekly.sh: which groups to run (an "Update" on one group). No file means every group.
const REQUEST = path.join(ROOT, "logs", "run-request.json");
const ADDED = path.join(ROOT, "state", "groups-added.json");
const REMOVED = path.join(ROOT, "state", "groups-removed.json");
const EXPORTER = path.join(ROOT, "wa", "export.mjs");

const prisma = makePrisma();

// Written only when they changed, so the pipeline's config files are not touched every minute.
function writeIfChanged(file: string, data: unknown) {
  const next = JSON.stringify(data, null, 1) + "\n";
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === next) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  console.log(`${new Date().toISOString()} wrote ${file}`);
}

async function mirrorAddedGroups() {
  writeIfChanged(ADDED, await addedGroupsConfig(prisma));
  writeIfChanged(REMOVED, await removedGroupKeys(prisma));
}

// Same WhatsApp Web session as the weekly job, so it takes the same lock; quick (no chats are opened).
async function listChats(id: string) {
  try { fs.mkdirSync(LOCK); } catch {
    // The Monday job started in the meantime: hand the request back to the queue.
    await prisma.updateRun.update({ where: { id }, data: { status: "queued", startedAt: null } });
    return;
  }
  try {
    const res = spawnSync(process.execPath, [EXPORTER, "list"], { cwd: path.dirname(EXPORTER), encoding: "utf8", timeout: 6 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });
    if (res.status !== 0) {
      const why = res.status === 3 ? "WhatsApp Web is not linked on the Mac (run `python3 -m trendbot login`)." : (res.stderr || String(res.error ?? "")).trim().split("\n").pop();
      await finishRun(prisma, id, "failed", `Could not read the WhatsApp groups: ${why}`);
      return;
    }
    const chats = await saveChatList(prisma, (JSON.parse(res.stdout) as { chats: WaChat[] }).chats);
    await finishRun(prisma, id, "done", `${chats.length} WhatsApp groups`);
  } finally {
    fs.rmdirSync(LOCK);
  }
}

try {
  await mirrorAddedGroups();
  // The Monday job is running: leave requests queued and take them once it finishes.
  const run = fs.existsSync(LOCK) ? null : await claimNext(prisma);
  if (run?.kind === "list-chats") {
    console.log(`${new Date().toISOString()} listing WhatsApp groups for ${run.requestedBy}`);
    await listChats(run.id);
  } else if (run) {
    console.log(`${new Date().toISOString()} running ${run.id} (${run.groupKey ?? "all groups"}) for ${run.requestedBy}`);
    const started = Date.now();
    fs.rmSync(REQUEST, { force: true });
    if (run.groupKey) fs.writeFileSync(REQUEST, JSON.stringify({ groups: [run.groupKey], at: started / 1000 }));
    // -W waits for the app, which waits for run_weekly.sh; the script's own limits end it well before this one.
    const res = spawnSync("/usr/bin/open", ["-W", "-g", APP], { timeout: 2 * 60 * 60 * 1000 });
    fs.rmSync(REQUEST, { force: true }); // in case the script never got to read it
    let status: "done" | "review" | "failed" = "failed";
    let message = res.error ? `Could not start the update: ${res.error.message}` : "The update did not report a result; see logs/ on the Mac.";
    try {
      const r = JSON.parse(fs.readFileSync(RESULT, "utf8")) as { code: number; message: string; at: number };
      // Ignore a result left over from an earlier run.
      if (r.at * 1000 >= started - 5_000) {
        status = statusFromCode(r.code);
        message = r.message;
      }
    } catch {}
    await finishRun(prisma, run.id, status, message);
    console.log(`${new Date().toISOString()} ${run.id}: ${status}: ${message}`);
  }
} finally {
  await prisma.$disconnect();
}
