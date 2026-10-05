import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { makePrisma } from "../lib/db";
import { importGroup, type ArtifactDoc } from "../lib/importArtifacts";
import type { Snapshot } from "../lib/sync";

const ROOT = path.join(import.meta.dirname, "..", "..");
config({ path: path.join(ROOT, ".env"), quiet: true });
const prisma = makePrisma();
for (const key of ["overland", "sombreros", "members", "briefings", "moves"]) {
  const docs = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "import", `${key}.json`), "utf8")) as ArtifactDoc[];
  const published = JSON.parse(fs.readFileSync(path.join(ROOT, "state", key, "published.json"), "utf8")) as Record<string, string>;
  const slugs = Object.keys(published).filter((p) => p.startsWith("vendors/")).map((p) => p.slice("vendors/".length));
  const snap = JSON.parse(fs.readFileSync(path.join(ROOT, "state", key, "site.json"), "utf8")) as Snapshot;
  const r = await importGroup(prisma, key, docs, slugs, snap);
  console.log(`${key}: ${docs.length} docs on the artifact, ${r.manual} manual imported, ${r.deleted} deletions carried over`);
}
await prisma.$disconnect();
