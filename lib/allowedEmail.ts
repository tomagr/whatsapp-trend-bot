// Only verified Google accounts on the allowed Workspace domain may sign in.
export function isAllowedEmail(email: unknown, verified: unknown, domain = process.env.AUTH_ALLOWED_EMAIL_DOMAIN): boolean {
  if (!domain || typeof email !== "string" || verified !== true) return false;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase().replace(/^@/, "")}`);
}
