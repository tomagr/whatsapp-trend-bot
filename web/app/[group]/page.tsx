import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { notFound, permanentRedirect } from "next/navigation";
import { auth } from "@/auth";
import GroupView from "@/components/GroupView";
import NavBar from "@/components/NavBar";
import { db } from "@/lib/db";
import { COPY, GROUP_KEYS, type GroupKey } from "@/lib/groupCopy";
import { resolveSlug } from "@/lib/slugs";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ group: string }> };

// The group page's own type pair; .g-root swaps them in for the site-wide display and body fonts.
const guideDisplay = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--ff-guide-display" });
const guideBody = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--ff-guide-body" });

const isKey = (k: string): k is GroupKey => (GROUP_KEYS as string[]).includes(k);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group: slug } = await params;
  const { group: g } = await resolveSlug(db(), slug);
  if (!g || !isKey(g.key)) return { title: "Not found", robots: { index: false } };
  // Same heading the page itself shows, e.g. "Recomendaciones de Sombreros misteriosos".
  const { h1, lede } = COPY[g.key];
  const title = h1.join("");
  const url = `/${g.slug}`;
  return {
    title,
    description: lede,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, title, description: lede, url, locale: g.lang === "en" ? "en_GB" : "es_AR" },
    // og:image comes from ./opengraph-image.tsx.
    twitter: { card: "summary_large_image", title, description: lede },
  };
}

export default async function GroupPage({ params }: Props) {
  const { group: slug } = await params;
  const user = (await auth())?.user;
  const { group: g, redirectTo } = await resolveSlug(db(), slug);
  if (redirectTo) permanentRedirect(`/${redirectTo}`);
  if (!g || !isKey(g.key)) notFound();
  const group = g.key;
  const [vendors, opportunities] = await Promise.all([
    db().vendor.findMany({ where: { groupKey: group, deletedAt: null },
      select: { id: true, name: true, category: true, service: true, location: true, contact: true, recommendedBy: true,
                note: true, quote: true, mentions: true, sentiment: true, type: true, dates: true, source: true } }),
    // Opportunities are private: never query them, so nothing reaches a logged-out browser.
    user ? db().opportunity.findMany({ where: { groupKey: group }, orderBy: { rank: "asc" } }) : Promise.resolve([]),
  ]);
  return (
    <div className={`${guideDisplay.variable} ${guideBody.variable}`}>
      <GroupView
        userBar={<NavBar user={user} signOutTo={`/${g.slug}`} />}
        signedIn={!!user}
        groupKey={group}
        lang={g.lang === "en" ? "en" : "es"}
        mode={g.vendorMode === "type" ? "type" : "sentiment"}
        status={{ checkedAt: g.checkedAt, messagesThrough: g.messagesThrough }}
        // Who recommended a vendor is a group member's name: blank it server-side so it never reaches a logged-out browser.
        vendors={user ? vendors : vendors.map((v) => ({ ...v, recommendedBy: "" }))}
        opportunities={opportunities.map((o) => ({ ...o, quotes: (o.quotes as { date?: string; who?: string; text?: string }[]) ?? [] }))}
      />
    </div>
  );
}
