import { db } from "@/lib/db";
import { resolveSlug } from "@/lib/slugs";

// The WhatsApp group photo stored by the weekly run. Public, like the group page itself.
export async function GET(req: Request, { params }: { params: Promise<{ group: string }> }) {
  const { group: slug } = await params;
  const { group: g, redirectTo } = await resolveSlug(db(), slug);
  const key = g?.key ?? (redirectTo ? (await db().group.findUnique({ where: { slug: redirectTo }, select: { key: true } }))?.key : null);
  if (!key) return new Response("Not found", { status: 404 });
  const row = await db().group.findUnique({ where: { key }, select: { photo: true, photoType: true, photoHash: true } });
  if (!row?.photo || !row.photoType || !row.photoHash) return new Response("Not found", { status: 404 });
  // Versioned URLs (?v=<hash>) never change content; a bare URL is re-checked hourly.
  const versioned = new URL(req.url).searchParams.get("v") === row.photoHash.slice(0, 12);
  return new Response(row.photo, {
    headers: {
      "Content-Type": row.photoType,
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      ETag: `"${row.photoHash}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
