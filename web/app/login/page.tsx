import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { authEnabled } from "@/lib/authMode";
import SignInButton from "./SignInButton";
import "./login.css";

export const metadata: Metadata = { title: "Sign in · WhatsApp Trend Pages", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ error?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error } = await searchParams;
  // Signing in always lands on the home page; in open mode there is nothing to sign in to.
  if (!authEnabled() || (await auth())?.user) redirect("/");
  const domain = process.env.AUTH_ALLOWED_EMAIL_DOMAIN?.replace(/^@/, "");
  const account = domain ? `@${domain}` : "an allowed";
  const errorText = !error ? ""
    : error === "AccessDenied" ? `That Google account can’t sign in here. Continue with your ${account} account instead.`
    : error === "Configuration" ? "Sign-in isn’t set up correctly on the server. Ask whoever runs this site to check the Google auth settings."
    : "Sign-in didn’t finish. Try again.";
  return (
    <div className="g-root g-index login-page">
      <main className="login-card" aria-labelledby="login-title">
        <p className="login-brand">Trend <span>pages</span></p>
        <h1 id="login-title">Sign in to see every group</h1>
        <p className="login-lede">Group pages are public. Sign in with {domain ? <b>your @{domain} Google account</b> : "your Google account"} to also get:</p>
        <ul className="login-perks">
          <li>The index of all the WhatsApp groups</li>
          <li>Business opportunities: what each group keeps asking for</li>
          <li>Who recommended each vendor</li>
          <li>The admin page that pulls in new messages</li>
        </ul>
        {errorText && <p className="login-error" role="alert">{errorText}</p>}
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
          <SignInButton />
        </form>
      </main>
    </div>
  );
}
