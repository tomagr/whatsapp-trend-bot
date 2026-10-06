// Turns the free-text contact field (written by the pipeline or a member) into tappable actions.
// Only https/mailto/tel hrefs are ever produced, so nothing in the text can become a script URL.
export type ContactAction = { kind: "whatsapp" | "call" | "site" | "linkedin" | "instagram" | "email"; href: string; label: string };

const URL_RE = /\bhttps?:\/\/[^\s;,]+/gi;
const BARE_RE = /(?<![@\w.\/-])(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,6}(?:\/[^\s;,]*)?(?![\w@])/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const IG_RE = /instagram\s*:?\s*@?([a-z0-9_.]{3,30})|(?<![\w.])@([a-z0-9_.]{3,30})(?![\w@.]*\.[a-z]{2,6}\b)/gi;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/g;
// "vCard shared", "contact by private message": the number exists only inside the group.
const IN_GROUP_RE = /vcard|contacto compartido|compartid[oa]|por privado|sin n[uú]mero/i;

function siteAction(raw: string): ContactAction | null {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host.endsWith("linkedin.com")) return { kind: "linkedin", href: u.href, label: "LinkedIn" };
  if (host.endsWith("instagram.com")) return { kind: "instagram", href: u.href, label: "Instagram" };
  return { kind: "site", href: u.href, label: host };
}

export function contactActions(contact: string): { actions: ContactAction[]; inGroup: boolean } {
  const c = String(contact ?? "");
  const actions: ContactAction[] = [];
  const seen = new Set<string>();
  const add = (a: ContactAction | null) => { if (a && !seen.has(a.href)) { seen.add(a.href); actions.push(a); } };

  let rest = c;
  for (const m of c.match(EMAIL_RE) ?? []) { add({ kind: "email", href: `mailto:${m}`, label: m }); rest = rest.replace(m, " "); }
  for (const m of rest.match(URL_RE) ?? []) { add(siteAction(m)); rest = rest.replace(m, " "); }
  for (const m of rest.match(BARE_RE) ?? []) { add(siteAction(m)); rest = rest.replace(m, " "); }
  for (const m of rest.matchAll(IG_RE)) {
    const handle = (m[1] ?? m[2]).replace(/\.$/, "");
    add({ kind: "instagram", href: `https://instagram.com/${handle}`, label: `@${handle}` });
  }
  // Only text left after links and emails, so ids inside URLs are never read as phone numbers.
  for (const m of rest.match(PHONE_RE) ?? []) {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;
    add({ kind: "whatsapp", href: `https://wa.me/${digits}`, label: "WhatsApp" });
    add({ kind: "call", href: `tel:+${digits}`, label: m.trim() });
  }
  return { actions, inGroup: !actions.length && IN_GROUP_RE.test(c) };
}
