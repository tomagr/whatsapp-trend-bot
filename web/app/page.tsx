import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { db } from "@/lib/db";
import { groupPhotoUrl } from "@/lib/groupPhoto";
import { ADDED_SECTION, copyFor } from "@/lib/groupCopy";
import { orderedGroups } from "@/lib/groups";
import { rowStyle } from "@/lib/groupStyle";
import { fmtLong } from "@/lib/filter";
import NavBar from "@/components/NavBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Index() {
  const user = await currentUser();
  // The index is for signed-in users only (everyone in open mode); group pages stay public.
  if (!user) redirect("/login");
  const rows = (await orderedGroups(db())).map((g) => ({ ...g, copy: copyFor(g) }));
  // Built-in sections first, then the groups added from /admin.
  const sections = [...new Set(rows.map((g) => g.copy.community))].sort((a, b) => Number(a === ADDED_SECTION) - Number(b === ADDED_SECTION));
  return (
    <div className="g-root g-index index">
      <div className="wrap">
        <NavBar user={user} />
        <header>
          <div className="eyebrow">{rows.length} WhatsApp group{rows.length === 1 ? "" : "s"} · updated every Monday</div>
          <h1>Trend <span>pages</span></h1>
          <p className="lede">Each page lists the vendors people recommended in a group and the business opportunities behind what members keep asking for.</p>
          <div className="header-actions"><Link className="btn" href="/admin">Admin: update messages →</Link></div>
        </header>
        {sections.map((s) => (
          <section key={s}>
            <h2>{s}</h2>
            <div className="list">
              {rows.filter((g) => g.copy.community === s).map((g) => (
                <div key={g.key} className="row-wrap">
                  <Link className={`page${g.addedAt ? " custom" : ""}`} style={rowStyle(g)} href={`/${g.slug}`}>
                    {g.photoHash ? <Image className="swatch photo" src={groupPhotoUrl(g.slug, g.photoHash)!} alt="" width={28} height={28} unoptimized /> : <span className="swatch" aria-hidden="true" />}
                    <span className="name">{g.copy.eyebrowName}</span>
                    <span className="meta">{g.copy.indexMeta}{g.checkedAt ? ` · checked ${fmtLong(g.checkedAt, "en-GB")}` : ""}</span>
                    <span className="desc">{g.copy.indexDesc}</span>
                    <span className="go">Open →</span>
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))}
        <footer>
          Each page has two tabs: <b>vendors</b> and <b>business opportunities</b>. New messages are analysed every Monday and show up here automatically.
        </footer>
      </div>
    </div>
  );
}
