import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb } from "./helpers";
import { isSuperadmin, listUsers, recordSignIn } from "@/lib/users";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => { t = await createTestDb(); });
afterAll(async () => { await t.drop(); });
beforeEach(async () => { await t.prisma.user.deleteMany({ where: { email: { not: "tomas@amalgama.co" } } }); });

const at = (min: number) => new Date(Date.UTC(2026, 9, 6, 12, min));

test("the migration makes tomas@amalgama.co a superadmin", async () => {
  expect(await isSuperadmin(t.prisma, "Tomas@amalgama.co")).toBe(true);
  expect(await isSuperadmin(t.prisma, "someone@amalgama.co")).toBe(false);
  expect(await isSuperadmin(t.prisma, null)).toBe(false);
});

test("a sign-in adds the person once and refreshes them later, keeping the superadmin flag", async () => {
  await recordSignIn(t.prisma, { email: "Ana@amalgama.co", name: "Ana" }, at(0));
  await recordSignIn(t.prisma, { email: "ana@amalgama.co", name: "Ana B", image: "https://x/a.png" }, at(5));
  await recordSignIn(t.prisma, { email: "tomas@amalgama.co", name: "Tomas" }, at(6));
  const ana = await t.prisma.user.findUnique({ where: { email: "ana@amalgama.co" } });
  expect(ana).toMatchObject({ name: "Ana B", image: "https://x/a.png", superadmin: false, firstSeenAt: at(0), lastSeenAt: at(5) });
  expect(await isSuperadmin(t.prisma, "tomas@amalgama.co")).toBe(true);
  expect((await listUsers(t.prisma)).map((u) => u.email)).toEqual(["tomas@amalgama.co", "ana@amalgama.co"]);
});
