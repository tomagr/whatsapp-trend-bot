// Ported from the artifact pages' script (search, grouping, contact links, dates).
export type ListVendor = {
  name: string; category: string; service: string; location: string; contact: string;
  recommendedBy: string; quote: string; mentions: number; sentiment: string | null; type: string | null;
};

export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matches(v: ListVendor, q: string, cat: string, filterKey: "sentiment" | "type", filterVal: string) {
  if (cat && v.category !== cat) return false;
  if (filterVal && v[filterKey] !== filterVal) return false;
  if (!q) return true;
  const hay = norm([v.name, v.category, v.service, v.location, v.contact, v.recommendedBy, v.quote].join(" "));
  return norm(q).split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}

export function categoryCounts(vs: ListVendor[], locale: string): [string, number][] {
  const counts: Record<string, number> = {};
  for (const v of vs) counts[v.category] = (counts[v.category] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale));
}

export function groupByCategory<V extends ListVendor>(vs: V[], locale: string): [string, V[]][] {
  const groups: Record<string, V[]> = {};
  for (const v of vs) (groups[v.category] ||= []).push(v);
  return Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], locale))
    .map(([c, items]) => [c, [...items].sort((a, b) => (b.mentions || 1) - (a.mentions || 1) || a.name.localeCompare(b.name, locale))]);
}

type Dated = { name: string; mentions: number; dates: string[] };
// Dates are ISO "YYYY-MM-DD", so the string maximum is the latest one.
const lastDate = (v: Dated) => v.dates.reduce((a, b) => (b > a ? b : a), "");

// The "most recommended" spotlight: only vendors the group brought up more than once.
export function topPicks<V extends Dated>(vs: V[], n: number, locale: string): V[] {
  return vs.filter((v) => (v.mentions || 1) > 1)
    .sort((a, b) => b.mentions - a.mentions || lastDate(b).localeCompare(lastDate(a)) || a.name.localeCompare(b.name, locale))
    .slice(0, n);
}

export function recentlyMentioned<V extends Dated>(vs: V[], n: number, locale: string): (V & { lastDate: string })[] {
  return vs.map((v) => ({ ...v, lastDate: lastDate(v) })).filter((v) => v.lastDate)
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, locale))
    .slice(0, n);
}

export function splitContact(c: string): ({ text: string } | { href: string; text: string })[] {
  return String(c).split(/(https?:\/\/[^\s;,]+)/g).filter(Boolean).map((p) =>
    /^https?:\/\//.test(p) ? { href: p, text: p.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") } : { text: p });
}

export const fmtDate = (d: string) => { const [y, m, dd] = String(d).split("-"); return dd && m ? `${dd}/${m}/${y}` : d; };

// "2026-10-06" -> "6 Oct 2026"; with thisYear, dates in that year leave the year out ("6 Oct").
export function fmtLong(d: string | null | undefined, locale: string, thisYear?: number) {
  if (!d) return "";
  const [y, mo, dd] = d.split("-").map(Number);
  return new Date(y, mo - 1, dd).toLocaleDateString(locale, { day: "numeric", month: "short", ...(y === thisYear ? {} : { year: "numeric" }) });
}

export function fmtMonth(d: string, locale: string) {
  if (!d) return "";
  const [y, m] = d.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
}
