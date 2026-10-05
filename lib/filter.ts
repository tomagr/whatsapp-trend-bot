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

export function splitContact(c: string): ({ text: string } | { href: string; text: string })[] {
  return String(c).split(/(https?:\/\/[^\s;,]+)/g).filter(Boolean).map((p) =>
    /^https?:\/\//.test(p) ? { href: p, text: p.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") } : { text: p });
}

export const fmtDate = (d: string) => { const [y, m, dd] = String(d).split("-"); return dd && m ? `${dd}/${m}/${y}` : d; };

export function fmtLong(d: string | null | undefined, locale: string) {
  if (!d) return "";
  const [y, mo, dd] = d.split("-").map(Number);
  return new Date(y, mo - 1, dd).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtMonth(d: string, locale: string) {
  if (!d) return "";
  const [y, m] = d.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
}
