import { expect, test } from "vitest";
import { authEnabled } from "@/lib/authMode";

test("sign-in is on only with the secret and both Google settings", () => {
  expect(authEnabled({ AUTH_SECRET: "s", AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "g" })).toBe(true);
  expect(authEnabled({})).toBe(false);
  expect(authEnabled({ AUTH_SECRET: "s", AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "" })).toBe(false);
  expect(authEnabled({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "g" })).toBe(false);
});
