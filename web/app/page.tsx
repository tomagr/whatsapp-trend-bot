import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { COPY, GROUP_KEYS } from "@/lib/groupCopy";
import { fmtLong } from "@/lib/filter";
import SlugEditor from "@/components/SlugEditor";
import UserBar from "@/components/UserBar";

export const dynamic = "force-dynamic";

export default async function Index() {
  const user = (await auth())?.user;
  const rows = await db().group.findMany();
  const checked = new Map(rows.map((g) => [g.key, g.checkedAt]));
  const slugs = new Map(rows.map((g) => [g.key, g.slug]));
  const sections = ["Communities", "Fitness & health tech"] as const;
  return (
    <div className="g-root g-index index">
      <div className="wrap">
        <UserBar email={user?.email} loginHref="/login" />
        <header>
          <div className="eyebrow">5 WhatsApp groups · updated every Monday</div>
          <h1>Trend <span>pages</span></h1>
          <p className="lede">Each page lists the vendors people recommended in a group and the business opportunities behind what members keep asking for.</p>
        </header>
        {sections.map((s) => (
          <section key={s}>
            <h2>{s}</h2>
            <div className="list">
              {GROUP_KEYS.filter((k) => COPY[k].community === s).map((k) => (
                <div key={k} className="row-wrap">
                  <Link className="page" style={{ ["--c" as string]: `var(--g-${k})` }} href={`/${slugs.get(k) ?? k}`}>
                    <span className="swatch" aria-hidden="true" />
                    <span className="name">{COPY[k].eyebrowName}</span>
                    <span className="meta">{COPY[k].indexMeta}{checked.get(k) ? ` · checked ${fmtLong(checked.get(k), "en-GB")}` : ""}</span>
                    <span className="desc">{COPY[k].indexDesc}</span>
                    <span className="go">Open →</span>
                  </Link>
                  {user && slugs.has(k) && <SlugEditor groupKey={k} slug={slugs.get(k)!} />}
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
