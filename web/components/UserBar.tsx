import { signOut } from "@/auth";

// Signed in: email + sign out. Signed out: a sign-in link if loginHref is given, otherwise nothing.
// After signing out the user lands on signOutTo (default: the home page, which then sends them to /login).
export default function UserBar({ email, loginHref, signOutTo = "/" }: { email?: string | null; loginHref?: string; signOutTo?: string }) {
  if (!email) return loginHref ? <div className="userbar"><a href={loginHref}>Sign in</a></div> : null;
  return (
    <form className="userbar" action={async () => { "use server"; await signOut({ redirectTo: signOutTo }); }}>
      <span className="who">{email}</span>
      <button type="submit">Sign out</button>
    </form>
  );
}
