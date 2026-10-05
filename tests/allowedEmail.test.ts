import { expect, test } from "vitest";
import { isAllowedEmail } from "@/lib/allowedEmail";

test("accepts verified emails on the allowed domain, case-insensitively", () => {
  expect(isAllowedEmail("ana@amalgama.co", true, "amalgama.co")).toBe(true);
  expect(isAllowedEmail("Ana@Amalgama.CO", true, "@amalgama.co")).toBe(true);
});

test("rejects other domains, lookalikes, unverified and missing config", () => {
  expect(isAllowedEmail("ana@gmail.com", true, "amalgama.co")).toBe(false);
  expect(isAllowedEmail("ana@evilamalgama.co", true, "amalgama.co")).toBe(false);
  expect(isAllowedEmail("ana@amalgama.co.evil.com", true, "amalgama.co")).toBe(false);
  expect(isAllowedEmail("ana@amalgama.co", false, "amalgama.co")).toBe(false);
  expect(isAllowedEmail("ana@amalgama.co", true, "")).toBe(false);
  expect(isAllowedEmail(undefined, true, "amalgama.co")).toBe(false);
});
