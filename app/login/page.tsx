import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

// Keep only the path (the proxy sends an absolute URL) so the login page can't be used as an open redirect.
function safePath(url?: string) {
  if (!url) return "/";
  try {
    const u = new URL(url, "http://local");
    // Collapse leading slashes: "//evil.com" would be a protocol-relative redirect.
    return "/" + (u.pathname + u.search).replace(/^\/+/, "");
  } catch {
    return "/";
  }
}

export default async function Login({ searchParams }: Props) {
  const { callbackUrl, error } = await searchParams;
  const to = safePath(callbackUrl);
  if ((await auth())?.user) redirect(to);
  const domain = process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "");
  return (
    <div className="g-root g-index index">
      <div className="wrap">
        <header>
          <div className="eyebrow">Amalgama only</div>
          <h1>Trend <span>pages</span></h1>
          <p className="lede">Sign in with your @{domain} Google account.</p>
        </header>
        <form className="login" action={async () => { "use server"; await signIn("google", { redirectTo: to }); }}>
          <button className="primary" type="submit">Continue with Google</button>
          {error && <p className="login-error" role="alert">{error === "AccessDenied" ? `Only @${domain} accounts can sign in.` : "Sign-in failed. Try again."}</p>}
        </form>
      </div>
    </div>
  );
}
