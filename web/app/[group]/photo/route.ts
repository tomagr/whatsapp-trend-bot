import { auth } from "@/auth";
import { db } from "@/lib/db";

// The WhatsApp group's picture. Pictures can show members or their children, so like the
// opportunities tab it is for signed-in users only. The page links it with ?v=<hash>, so it can be cached for good.
export async function GET(_req: Request, { params }: { params: Promise<{ group: string }> }) {
  if (!(await auth())?.user) return new Response(null, { status: 404 });
  const { group: slug } = await params;
  const photo = await db().groupPhoto.findFirst({ where: { group: { slug } }, select: { data: true, mime: true } });
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
