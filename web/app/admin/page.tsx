import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import NavBar from "@/components/NavBar";
import AdminGroupRow from "@/components/AdminGroupRow";
import UpdatePanel from "@/components/UpdatePanel";
import { db } from "@/lib/db";
import { groupPhotoUrl } from "@/lib/groupPhoto";
import { copyFor } from "@/lib/groupCopy";
import { chatsToOffer, orderedGroups } from "@/lib/groups";
import { rowStyle } from "@/lib/groupStyle";
import { stripEmoji } from "@/lib/ogImage";
import { activeRun, recentRuns } from "@/lib/updateRuns";
import { isSuperadmin, listUsers } from "@/lib/users";
import AddGroupPanel from "@/components/AddGroupPanel";
import { GroupRestoreButton } from "@/components/GroupRemoveButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · WhatsApp Trend Pages", robots: { index: false, follow: false } };

// Times are shown in the team's zone, whatever region the function runs in.
const fmt = (d: Date | string | null) => !d ? "—" : new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
}).format(new Date(d));

// "2026-10-06" -> "6 Oct"; the year only when it is not this year's.
const shortDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(y === new Date().getFullYear() ? {} : { year: "numeric" }) });
};

export default async function Admin() {
  const user = (await auth())?.user;
  if (!user) redirect("/login");
  const prisma = db();
  const superadmin = await isSuperadmin(prisma, user.email);
  const [active, runs, users, groups, counts, offer, chatRun, removed] = await Promise.all([
    activeRun(prisma),
    superadmin ? recentRuns(prisma, 50) : [],
    superadmin ? listUsers(prisma) : [],
    orderedGroups(prisma),
    prisma.vendor.groupBy({ by: ["groupKey"], where: { deletedAt: null }, _count: true }),
    chatsToOffer(prisma),
    prisma.updateRun.findFirst({ where: { kind: "list-chats" }, orderBy: { requestedAt: "desc" } }),
    orderedGroups(prisma, { removed: true }),
  ]);
  const byKey = new Map([...groups, ...removed].map((g) => [g.key, g]));
  const vendorCount = new Map(counts.map((c) => [c.groupKey, c._count]));
  const groupName = (k: string | null) => { const g = k ? byKey.get(k) : null; return !k ? "all groups" : g ? stripEmoji(copyFor(g).eyebrowName) : k; };
  const scope = (r: { kind: string; groupKey: string | null }) => r.kind === "list-chats" ? "WhatsApp group list" : groupName(r.groupKey);
  const runRow = (r: (typeof runs)[number]) => (
    <li key={r.id} className="run">
      <span className={`run-status s-${r.status}`}>{r.status}</span>
      <span className="run-when">{fmt(r.requestedAt)}</span>
      <span className="run-scope">{scope(r)}</span>
      <span className="run-who">{r.requestedBy}</span>
      {r.message && <span className="run-msg">{r.message}</span>}
    </li>
  );
  const chatPending = !!chatRun && (chatRun.status === "queued" || chatRun.status === "running");
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
            requestedAt: fmt(active.requestedAt), startedAt: active.startedAt ? fmt(active.startedAt) : null, scope: scope(active) }} />
        </section>

        {superadmin && <section>
          <h2>Recent runs</h2>
          {!runs.length ? <p className="muted">No runs requested from here yet.</p> : (
            <>
              <ul className="runs">{runs.slice(0, 2).map(runRow)}</ul>
              {runs.length > 2 && (
                <details className="runs-more">
                  <summary>See all runs ({runs.length}{runs.length === 50 ? ", latest" : ""})</summary>
                  <ul className="runs">{runs.slice(2).map(runRow)}</ul>
                </details>
              )}
            </>
          )}
        </section>}

        <section>
          <div className="groups-head">
            <h2>Groups</h2>
            <AddGroupPanel offer={offer && { fetchedAt: offer.fetchedAt.toISOString(), chats: offer.chats }} pending={chatPending}
              failed={chatRun?.status === "failed" ? chatRun.message : null} />
          </div>
          <ul className="grp-list">
            {groups.map((g) => (
              <AdminGroupRow key={g.key} groupKey={g.key} slug={g.slug} name={groupName(g.key)} style={rowStyle(g)} custom={!!g.addedAt}
                photoUrl={g.photoHash ? groupPhotoUrl(g.slug, g.photoHash)! : null} vendors={vendorCount.get(g.key) ?? 0}
                checked={g.checkedAt ? shortDate(g.checkedAt) : null} latest={g.messagesThrough ? shortDate(g.messagesThrough) : null}
                updateDisabled={!!active} />
            ))}
          </ul>
          {removed.length > 0 && (
            <details className="removed-groups">
              <summary>Removed groups ({removed.length})</summary>
              {removed.map((g) => (
                <div key={g.key} className="removed-row">
                  <div>
                    <b>{groupName(g.key)}</b>
                    <div className="meta">removed {fmt(g.removedAt)}{g.removedBy ? ` by ${g.removedBy}` : ""}</div>
                  </div>
                  <GroupRestoreButton groupKey={g.key} />
                </div>
              ))}
            </details>
          )}
        </section>

        {superadmin && (
          <section>
            <h2>Users</h2>
            {!users.length ? <p className="muted">Nobody has signed in yet.</p> : (
              <ul className="runs users">
                {users.map((u) => (
                  <li key={u.email} className="run">
                    <span className="run-status">{u.superadmin ? "superadmin" : "user"}</span>
                    <span className="run-when" title="Last sign-in">{fmt(u.lastSeenAt)}</span>
                    <span className="run-scope">{u.name ?? "—"}</span>
                    <span className="run-who">{u.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
