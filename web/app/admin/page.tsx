import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import NavBar from "@/components/NavBar";
import GroupUpdateButton from "@/components/GroupUpdateButton";
import UpdatePanel from "@/components/UpdatePanel";
import { db } from "@/lib/db";
import { groupPhotoUrl } from "@/lib/groupPhoto";
import { fmtLong } from "@/lib/filter";
import { COPY, GROUP_KEYS, type GroupKey } from "@/lib/groupCopy";
import { stripEmoji } from "@/lib/ogImage";
import { activeRun, recentRuns } from "@/lib/updateRuns";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · WhatsApp Trend Pages", robots: { index: false, follow: false } };

// Times are shown in the team's zone, whatever region the function runs in.
const fmt = (d: Date | string | null) => !d ? "—" : new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(d));

export default async function Admin() {
  const user = (await auth())?.user;
  if (!user) redirect("/login");
  const prisma = db();
  const [active, runs, groups, counts] = await Promise.all([
    activeRun(prisma),
    recentRuns(prisma, 10),
    prisma.group.findMany({ omit: { photo: true } }),
    prisma.vendor.groupBy({ by: ["groupKey"], where: { deletedAt: null }, _count: true }),
  ]);
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const vendorCount = new Map(counts.map((c) => [c.groupKey, c._count]));
  const groupName = (k: string | null) => !k ? "all groups" : (GROUP_KEYS as string[]).includes(k) ? stripEmoji(COPY[k as GroupKey].eyebrowName) : k;
  return (
    <div className="g-root g-index index admin">
      <div className="wrap">
        <NavBar user={user} />
        <header>
          <div className="eyebrow">Admin</div>
          <h1>Update <span>messages</span></h1>
          <p className="lede">Reads the new messages from the WhatsApp groups, analyses them and updates their pages. It runs for every group on its own every Monday at 09:00; run it now for all of them here, or for one group from the list below.</p>
        </header>

        <section>
          <UpdatePanel active={active && { id: active.id, status: active.status, requestedBy: active.requestedBy,
            requestedAt: fmt(active.requestedAt), startedAt: active.startedAt ? fmt(active.startedAt) : null, scope: groupName(active.groupKey) }} />
        </section>

        <section>
          <h2>Recent runs</h2>
          {!runs.length ? <p className="muted">No runs requested from here yet.</p> : (
            <ul className="runs">
              {runs.map((r) => (
                <li key={r.id} className="run">
                  <span className={`run-status s-${r.status}`}>{r.status}</span>
                  <span className="run-when">{fmt(r.requestedAt)}</span>
                  <span className="run-scope">{groupName(r.groupKey)}</span>
                  <span className="run-who">{r.requestedBy}</span>
                  {r.message && <span className="run-msg">{r.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Groups</h2>
          <div className="list">
            {GROUP_KEYS.map((k: GroupKey) => {
              const g = byKey.get(k);
              return (
                <div key={k} className="admin-group">
                  <Link className="page" style={{ ["--c" as string]: `var(--g-${k})` }} href={`/${g?.slug ?? k}`}>
                    {g?.photoHash ? <Image className="swatch photo" src={groupPhotoUrl(g.slug, g.photoHash)!} alt="" width={28} height={28} unoptimized /> : <span className="swatch" aria-hidden="true" />}
                    <span className="name">{groupName(k)}</span>
                    <span className="meta">{vendorCount.get(k) ?? 0} vendors · checked {g?.checkedAt ? fmtLong(g.checkedAt, "en-GB") : "—"} · messages through {g?.messagesThrough ?? "—"}</span>
                    <span className="go">Open →</span>
                  </Link>
                  <GroupUpdateButton groupKey={k} name={groupName(k)} disabled={!!active} />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
