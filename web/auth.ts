import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/allowedEmail";
import { db } from "@/lib/db";
import { recordSignIn } from "@/lib/users";

// AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read from the environment by Auth.js.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({ authorization: { params: { hd: process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "") } } })],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // `hd` only filters the Google account picker; this is the actual check.
    signIn: async ({ profile }) => {
      if (!isAllowedEmail(profile?.email, profile?.email_verified)) return false;
      // Kept for the users list in /admin; a database hiccup must not block signing in.
      await recordSignIn(db(), { email: profile!.email!, name: profile!.name, image: profile!.picture as string | undefined })
        .catch((e) => console.error("recordSignIn failed", e));
      return true;
    },
  },
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

