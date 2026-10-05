import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Locally, DATABASE_URL comes from the project root .env (shared with the Python job); on Vercel it is a project env var.
config({ path: path.join(process.cwd(), "..", ".env"), quiet: true });

const nextConfig: NextConfig = {
  // The CA bundle is read at runtime; make sure Vercel ships it with every function.
  outputFileTracingIncludes: { "/**": ["./certs/**"] },
};

export default nextConfig;
