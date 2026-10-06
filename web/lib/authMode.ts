// Google sign-in is optional. Without its settings the site runs in open mode: there is no login, every page
// (opportunities and /admin included) is public, and every visitor acts as this one user.
export function authEnabled(env: Record<string, string | undefined> = process.env) {
  return !!(env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

export const OPEN_USER = { email: "everyone", name: "Everyone", image: null } as const;
