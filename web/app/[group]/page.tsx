import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { auth } from "@/auth";
import GroupView from "@/components/GroupView";
import UserBar from "@/components/UserBar";
import { db } from "@/lib/db";
import { COPY, GROUP_KEYS, type GroupKey } from "@/lib/groupCopy";
import { resolveSlug } from "@/lib/slugs";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ group: string }> };

const isKey = (k: string): k is GroupKey => (GROUP_KEYS as string[]).includes(k);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group: slug } = await params;
  const { group: g } = await resolveSlug(db(), slug);
  return { title: g && isKey(g.key) ? COPY[g.key].title : "Not found" };
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
    <GroupView
      userBar={<UserBar email={user?.email} />}
      signedIn={!!user}
      groupKey={group}
      lang={g.lang === "en" ? "en" : "es"}
      mode={g.vendorMode === "type" ? "type" : "sentiment"}
      status={{ checkedAt: g.checkedAt, messagesThrough: g.messagesThrough }}
      // Who recommended a vendor is a group member's name: blank it server-side so it never reaches a logged-out browser.
      vendors={user ? vendors : vendors.map((v) => ({ ...v, recommendedBy: "" }))}
      opportunities={opportunities.map((o) => ({ ...o, quotes: (o.quotes as { date?: string; who?: string; text?: string }[]) ?? [] }))}
    />
  );
}
