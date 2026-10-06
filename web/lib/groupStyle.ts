// Accent colours for groups added from /admin (the original five have hand-picked palettes in groups.css).
// [light, dark]: the dark value is used under the dark theme, like the per-group tokens in groups.css.
export const ACCENTS: Record<string, [string, string]> = {
  rust: ["#9a3412", "#fdba74"],
  cyan: ["#0e7490", "#67e8f9"],
  lime: ["#4d7c0f", "#bef264"],
  fuchsia: ["#a21caf", "#f0abfc"],
  amber: ["#b45309", "#fcd34d"],
  rose: ["#be123c", "#fda4af"],
  blue: ["#1d4ed8", "#93c5fd"],
  emerald: ["#047857", "#6ee7b7"],
};
export const ACCENT_NAMES = Object.keys(ACCENTS);

const accent = (color: string | null | undefined) => ACCENTS[color ?? ""] ?? ACCENTS.blue;

// Inline vars for an added group's page root (.g-custom) or its home/admin row (.page.custom); CSS picks light or dark.
export function accentVars(color: string | null | undefined, prefix: "accent" | "c"): Record<string, string> {
  const [l, d] = accent(color);
  return { [`--${prefix}-l`]: l, [`--${prefix}-d`]: d };
}

// Light palette for the link-preview image, matching .g-custom.
export function customPalette(color: string | null | undefined) {
  return { bg: "#eff1f0", ink: "#18201e", muted: "#58635f", line: "#d3dad7", accent: accent(color)[0], signal: "#c2410c" };
}

// The next colour for a new group: the least used one, so added groups stay distinguishable.
export function nextAccent(used: (string | null)[]) {
  const count = (c: string) => used.filter((u) => u === c).length;
  return [...ACCENT_NAMES].sort((a, b) => count(a) - count(b))[0];
}

// Home/admin row: the built-in groups have a --g-<key> token in globals.css; added ones carry their own pair.
export function rowStyle(g: { key: string; addedAt?: Date | string | null; color?: string | null }): Record<string, string> {
  return g.addedAt ? accentVars(g.color, "c") : { "--c": `var(--g-${g.key})` };
}
