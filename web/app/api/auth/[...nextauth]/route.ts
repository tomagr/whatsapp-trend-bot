import { handlers } from "@/auth";
import { authEnabled } from "@/lib/authMode";

// Open mode (no Google settings): there is no sign-in to serve.
const off = () => new Response("Sign-in is not set up on this site.", { status: 404 });
export const GET = (...a: Parameters<typeof handlers.GET>) => authEnabled() ? handlers.GET(...a) : off();
export const POST = (...a: Parameters<typeof handlers.POST>) => authEnabled() ? handlers.POST(...a) : off();
