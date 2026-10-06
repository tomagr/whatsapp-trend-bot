import { expect, test } from "vitest";
import { pgConfig } from "@/lib/pgConfig";

test("TLS: off locally, Amazon's CA for RDS, public CAs elsewhere", () => {
  expect(pgConfig("postgres://u:p@localhost:5432/db?sslmode=disable").ssl).toBe(false);
  expect(pgConfig("postgres://u:p@127.0.0.1:5432/db").ssl).toBe(false);
  expect(pgConfig("postgres://u:p@x.abc.us-east-1.rds.amazonaws.com/db").ssl).toMatchObject({ ca: expect.stringContaining("BEGIN CERTIFICATE") });
  expect(pgConfig("postgres://u:p@ep-x.neon.tech/db?sslmode=require").ssl).toBe(true);
});

test("schema comes from ?schema= and query options never reach pg", () => {
  const c = pgConfig("postgres://u:p@localhost/db?schema=trend_bot&sslmode=disable");
  expect(c.schema).toBe("trend_bot");
  expect(c.connectionString).toBe("postgres://u:p@localhost/db");
});
