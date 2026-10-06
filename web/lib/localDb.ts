import { execFileSync } from "node:child_process";

// Without DATABASE_URL the data lives in a Postgres on this computer: Prisma's built-in local server (`prisma dev`),
// which needs no install and keeps its files in the user's app-data folder under this name.
// It is started in the background the first time anything needs the database and survives until the computer restarts.
export const LOCAL_DB_NAME = "whatsapptrendbot";

let url: string | undefined;

// Run from web/ (the site, its scripts and tests all are), like pgConfig's certificate path.
// Starts the local server if it is not running, brings its tables up to date and returns its connection URL.
export function localDatabaseUrl() {
  if (url) return url;
  const out = execFileSync("npx", ["prisma", "dev", "--name", LOCAL_DB_NAME, "--detach"], { encoding: "utf8", stdio: "pipe", timeout: 120_000 });
  const found = out.match(/postgres:\/\/\S+/)?.[0];
  if (!found) throw new Error(`could not start the local database (prisma dev printed: ${out.trim().slice(-300)})`);
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: found }, stdio: "pipe", timeout: 120_000 });
  return (url = found);
}

export const isLocalHost = (host: string) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
