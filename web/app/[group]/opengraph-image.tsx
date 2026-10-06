import { db } from "@/lib/db";
import { COPY, GROUP_KEYS, T, type GroupKey } from "@/lib/groupCopy";
import { OG_SIZE, ogImage, stripEmoji } from "@/lib/ogImage";
import { resolveSlug } from "@/lib/slugs";

export const alt = "WhatsApp group recommendations";
export const size = OG_SIZE;
export const contentType = "image/png";

// Light-theme values from groups.css, so the preview matches the page it links to.
const PALETTE: Record<GroupKey, { bg: string; ink: string; muted: string; line: string; accent: string; signal: string }> = {
  overland: { bg: "#eef0ea", ink: "#1d2219", muted: "#5d6656", line: "#d4d9cc", accent: "#3f5a2a", signal: "#c2620f" },
  sombreros: { bg: "#eef0f5", ink: "#1b1f2a", muted: "#5a6274", line: "#d3d8e3", accent: "#2c4f8a", signal: "#d2452f" },
  members: { bg: "#eef2f1", ink: "#172221", muted: "#566563", line: "#d0dad8", accent: "#0f6b62", signal: "#c2410c" },
  briefings: { bg: "#eef2f1", ink: "#172221", muted: "#566563", line: "#d0dad8", accent: "#3b4fa8", signal: "#c2410c" },
  moves: { bg: "#eef2f1", ink: "#172221", muted: "#566563", line: "#d0dad8", accent: "#7a3e8f", signal: "#c2410c" },
};

export default async function Image({ params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = await params;
  const { group: g, redirectTo } = await resolveSlug(db(), slug);
  const row = g ?? (redirectTo ? await db().group.findUnique({ where: { slug: redirectTo } }) : null);
  const key = (GROUP_KEYS as string[]).includes(row?.key ?? "") ? (row!.key as GroupKey) : "overland";
  const t = T[row?.lang === "en" ? "en" : "es"];
  const where = { groupKey: key, deletedAt: null };
  const [vendors, cats] = await Promise.all([
    db().vendor.count({ where }),
    db().vendor.groupBy({ by: ["category"], where }).then((r) => r.length),
  ]);
  return ogImage({
    palette: PALETTE[key],
    eyebrow: t.eyebrow + "Trend pages",
    title: stripEmoji(COPY[key].eyebrowName),
    subtitle: COPY[key].h1.join(""),
    footer: [`${vendors} ${t.vendors}`, `${cats} ${t.cats}`, t === T.en ? "Updated every Monday" : "Se actualiza cada lunes"],
  });
}
