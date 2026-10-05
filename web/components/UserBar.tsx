import { signOut } from "@/auth";

export default function UserBar({ email }: { email?: string | null }) {
  return (
    <form className="userbar" action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
      {email && <span className="who">{email}</span>}
      <button type="submit">Sign out</button>
    </form>
  );
}
