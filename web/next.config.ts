import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Locally, DATABASE_URL comes from the project root .env (shared with the Python job); on Vercel it is a project env var.
config({ path: path.join(process.cwd(), "..", ".env"), quiet: true });

const nextConfig: NextConfig = {
  // The CA bundle and the OG image fonts are read at runtime; make sure Vercel ships them with every function.
  outputFileTracingIncludes: { "/**": ["./certs/**", "./assets/fonts/**"] },
  // Google profile pictures in the nav avatar.
  images: { remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }] },
};

export default nextConfig;
