// Absolute URLs for og:image and canonical links. Vercel sets the production host; locally it falls back to the dev server.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL = host ? `https://${host}` : "http://localhost:3000";
export const SITE_NAME = "Trend pages";
