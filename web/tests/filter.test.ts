import { expect, test } from "vitest";
import { categoryCounts, fmtDate, groupByCategory, matches, recentlyMentioned, splitContact, topPicks } from "@/lib/filter";

const v = (o: Record<string, unknown>) => ({ name: "", category: "", service: "", location: "", contact: "", recommendedBy: "", quote: "", mentions: 1, sentiment: "positive", type: null, dates: [] as string[], ...o });

test("matches ignores accents and case", () => {
  const x = v({ name: "Gomería Sur", category: "Neumáticos", contact: "Victron dealer" });
  expect(matches(x, "neumaticos", "", "sentiment", "")).toBe(true);
  expect(matches(x, "VICTRON gomeria", "", "sentiment", "")).toBe(true);
  expect(matches(x, "mendoza", "", "sentiment", "")).toBe(false);
});

test("matches applies category and sentiment/type filters", () => {
  const x = v({ category: "A", sentiment: "mixed", type: "featured" });
  expect(matches(x, "", "B", "sentiment", "")).toBe(false);
  expect(matches(x, "", "A", "sentiment", "positive")).toBe(false);
  expect(matches(x, "", "A", "type", "featured")).toBe(true);
});

test("groupByCategory orders by size then name, items by mentions then name", () => {
  const out = groupByCategory([v({ name: "b", category: "X" }), v({ name: "a", category: "Y", mentions: 1 }), v({ name: "c", category: "Y", mentions: 3 })], "es");
  expect(out.map(([c, items]) => [c, items.map((i) => i.name)])).toEqual([["Y", ["c", "a"]], ["X", ["b"]]]);
  expect(categoryCounts([v({ category: "X" }), v({ category: "X" }), v({ category: "Y" })], "es")).toEqual([["X", 2], ["Y", 1]]);
});

test("splitContact links http(s) URLs and strips the scheme for display", () => {
  expect(splitContact("web https://www.foo.com/ ; tel 123")).toEqual([
    { text: "web " }, { href: "https://www.foo.com/", text: "foo.com" }, { text: " ; tel 123" },
  ]);
});

test("splitContact never links non-http schemes", () => {
  const parts = splitContact("javascript:alert(1) <b>x</b>");
  expect(parts.every((p) => !("href" in p))).toBe(true);
  expect(parts.map((p) => p.text).join("")).toBe("javascript:alert(1) <b>x</b>");
});

test("fmtDate renders DD/MM/YYYY like today's pages", () => {
  expect(fmtDate("2026-07-22")).toBe("22/07/2026");
});

test("topPicks keeps vendors recommended more than once, most mentions first, newest breaking ties", () => {
  const out = topPicks([
    v({ name: "once", mentions: 1, dates: ["2026-09-01"] }),
    v({ name: "old", mentions: 3, dates: ["2026-01-01"] }),
    v({ name: "new", mentions: 3, dates: ["2026-05-01", "2026-02-01"] }),
    v({ name: "top", mentions: 7, dates: [] }),
    v({ name: "two", mentions: 2, dates: [] }),
  ], 3, "es");
  expect(out.map((x) => x.name)).toEqual(["top", "new", "old"]);
});

test("recentlyMentioned orders by latest date and skips vendors without dates", () => {
  const out = recentlyMentioned([
    v({ name: "a", dates: ["2026-03-01"] }),
    v({ name: "b", dates: ["2026-01-01", "2026-09-10"] }),
    v({ name: "none", dates: [] }),
    v({ name: "c", dates: ["2026-06-01"] }),
  ], 2, "es");
  expect(out.map((x) => [x.name, x.lastDate])).toEqual([["b", "2026-09-10"], ["c", "2026-06-01"]]);
});
