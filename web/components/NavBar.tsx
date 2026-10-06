import Link from "next/link";
import AccountMenu from "./AccountMenu";

type User = { email?: string | null; name?: string | null; image?: string | null };

// Signed-in only: the site name back to the index and the avatar menu. Logged-out visitors get no nav.
export default function NavBar({ user, signOutTo = "/" }: { user?: User | null; signOutTo?: string }) {
  if (!user?.email) return null;
  return (
    <nav className="nav" aria-label="Site">
      <Link className="nav-home" href="/">Trend <span>pages</span></Link>
      <AccountMenu email={user.email} name={user.name ?? null} image={user.image ?? null} signOutTo={signOutTo} />
    </nav>
  );
}
