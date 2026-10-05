import path from "node:path";
import { config } from "dotenv";
import { makePrisma } from "../lib/db";
import { runSync } from "../lib/sync";

config({ path: path.join(import.meta.dirname, "..", "..", ".env"), quiet: true });

const i = process.argv.indexOf("--state");
const stateDir = i > 0 ? process.argv[i + 1] : path.join(import.meta.dirname, "..", "..", "state");

const prisma = makePrisma();
const out = await runSync(prisma, stateDir);
for (const r of out.results) console.log(`${r.key}: ${r.upserted} vendors, ${r.opportunities} opportunities, ${r.skippedDeleted} kept deleted`);
for (const f of out.failed) console.log(`${f.key}: FAILED ${f.error}`);
console.log("SYNC_JSON " + JSON.stringify(out));
await prisma.$disconnect();
process.exit(out.failed.length ? 1 : 0);
