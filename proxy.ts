export { auth as proxy } from "@/auth";

// Everything except the login page, Auth.js endpoints and static assets requires a session.
export const config = {
  matcher: ["/((?!login(?:/|$)|api/auth/|_next/static/|_next/image|favicon\\.ico$).*)"],
};
