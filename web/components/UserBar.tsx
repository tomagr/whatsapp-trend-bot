import { signOut } from "@/auth";

// Signed in: email + sign out. Signed out: a sign-in link back to the current page.
export default function UserBar({ email, loginHref }: { email?: string | null; loginHref: string }) {
  if (!email) return <div className="userbar"><a href={loginHref}>Sign in</a></div>;
  return (
    <form className="userbar" action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
      <span className="who">{email}</span>
      <button type="submit">Sign out</button>
    </form>
  );
}
