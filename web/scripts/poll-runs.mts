// Runs on the Mac every minute (launchd/com.whatsapptrendbot.poll.plist): picks up an "Update now" request
// queued from /admin, runs the weekly job through the launcher app and records the outcome for the page.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { makePrisma } from "../lib/db";
import { claimNext, finishRun, statusFromCode } from "../lib/updateRuns";

const ROOT = path.join(import.meta.dirname, "..", "..");
config({ path: path.join(ROOT, ".env"), quiet: true });

// Same app the Monday job opens, so the run gets the app's Full Disk Access.
const APP = path.join(ROOT, "app", "WhatsApp Trend Bot.app");
const RESULT = path.join(ROOT, "logs", "last-result.json");
const LOCK = path.join(ROOT, "logs", "run.lock");

// The Monday job is running: leave the request queued and take it once that finishes.
if (fs.existsSync(LOCK)) process.exit(0);

const prisma = makePrisma();
try {
  const run = await claimNext(prisma);
  if (run) {
    console.log(`${new Date().toISOString()} running ${run.id} for ${run.requestedBy}`);
    const started = Date.now();
    // -W waits for the app, which waits for run_weekly.sh; the script's own limits end it well before this one.
    const res = spawnSync("/usr/bin/open", ["-W", "-g", APP], { timeout: 2 * 60 * 60 * 1000 });
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
