import fs from "node:fs";
import path from "node:path";

// RDS presents a certificate signed by Amazon's own CA; verify it instead of skipping verification.
const CA_PATH = path.join(process.cwd(), "certs", "rds-global-bundle.pem");

export function pgConfig(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const u = new URL(url);
  const schema = u.searchParams.get("schema") ?? "public";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`invalid schema name: ${schema}`);
  u.search = ""; // pg would treat ?schema= and ?sslmode= as server options; TLS is configured below
  return { connectionString: u.toString(), ssl: { ca: fs.readFileSync(CA_PATH, "utf8") }, schema };
}
