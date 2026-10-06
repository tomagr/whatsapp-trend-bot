import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error } = await searchParams;
  // Signing in always lands on the home page.
  if ((await auth())?.user) redirect("/");
  const domain = process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "");
  return (
    <div className="g-root g-index index">
      <div className="wrap">
        <header>
          <div className="eyebrow">Amalgama only</div>
          <h1>Trend <span>pages</span></h1>
          <p className="lede">Sign in with your @{domain} Google account.</p>
        </header>
        <form className="login" action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
          <button className="primary" type="submit">Continue with Google</button>
          {error && <p className="login-error" role="alert">{error === "AccessDenied" ? `Only @${domain} accounts can sign in.` : "Sign-in failed. Try again."}</p>}
        </form>
      </div>
    </div>
  );
}
