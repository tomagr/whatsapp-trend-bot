import fs from "node:fs";
import path from "node:path";
import { isLocalHost, localDatabaseUrl } from "./localDb";

// RDS presents a certificate signed by Amazon's own CA; verify it instead of skipping verification.
const CA_PATH = path.join(process.cwd(), "certs", "rds-global-bundle.pem");

// No DATABASE_URL: use the local database on this computer (see lib/localDb.ts).
export function pgConfig(url = process.env.DATABASE_URL || localDatabaseUrl()) {
  const u = new URL(url);
  const schema = u.searchParams.get("schema") ?? "public";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`invalid schema name: ${schema}`);
  const sslmode = u.searchParams.get("sslmode");
  u.search = ""; // pg would treat ?schema= and ?sslmode= as server options; TLS is configured below
  const ssl = sslmode === "disable" || isLocalHost(u.hostname) ? false
    : u.hostname.endsWith(".rds.amazonaws.com") ? { ca: fs.readFileSync(CA_PATH, "utf8") }
    : true; // other hosted Postgres (Neon, Supabase, …): certificates from the public CAs
  return { connectionString: u.toString(), ssl, schema };
}
