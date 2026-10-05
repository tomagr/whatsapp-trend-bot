import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/allowedEmail";

// AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read from the environment by Auth.js.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { hd: process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "") } } })],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // `hd` only filters the Google account picker; this is the actual check.
    signIn: ({ profile }) => isAllowedEmail(profile?.email, profile?.email_verified),
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

