"use client";

// Group page: a compact, mobile-first vendor directory plus an opportunities tab that only signed-in users see.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { deleteVendor } from "@/app/actions";
import VendorRow, { type Vendor } from "@/components/VendorRow";
import { categoryCounts, fmtDate, fmtLong, fmtMonth, groupByCategory, matches } from "@/lib/filter";
import { COPY, T, type GroupKey } from "@/lib/groupCopy";

type Opp = { key: string; rank: number; title: string; summary: string; offer: string; alternatives: string; gap: string;
  signals: number; people: number; firstDate: string; lastDate: string; quotes: { date?: string; who?: string; text?: string }[] };
type Props = { userBar?: React.ReactNode; signedIn: boolean; photoUrl?: string; groupKey: GroupKey; lang: "es" | "en"; mode: "sentiment" | "type";
  status: { checkedAt: string | null; messagesThrough: string | null }; vendors: Vendor[]; opportunities: Opp[] };


// "#oportunidades" / "#opportunities" in the URL opens the second tab, as on the original pages.
const subscribeHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const hashWantsOpps = () => /oportunidades|opportunities/.test(window.location.hash);

export default function GroupView({ userBar, signedIn, photoUrl, groupKey, lang, mode, status, vendors, opportunities }: Props) {
  const t = T[lang];
  const c = COPY[groupKey];
  const [tabChoice, setTab] = useState<"vendors" | "opps" | null>(null);
  const fromHash = useSyncExternalStore(subscribeHash, hashWantsOpps, () => false);
  const tab = !signedIn ? "vendors" : tabChoice ?? (fromHash ? "opps" : "vendors");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [cat, setCat] = useState("");
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sheetRef = useRef<HTMLDialogElement>(null);

  useEffect(() => { const id = setTimeout(() => setQ(qInput.trim()), 120); return () => clearTimeout(id); }, [qInput]);

  const showTab = (which: "vendors" | "opps") => {
    setTab(which);
    try { history.replaceState(null, "", which === "opps" ? t.hashOpps : t.hashVendors); } catch {}
  };
  const cats = useMemo(() => categoryCounts(vendors, t.locale), [vendors, t.locale]);
  const shown = useMemo(() => vendors.filter((v) => matches(v, q, cat, mode, filter)), [vendors, q, cat, mode, filter]);
  const grouped = useMemo(() => groupByCategory(shown, t.locale), [shown, t.locale]);
  // The footer keeps the original pages' date style: DD/MM/YYYY in Spanish, "Sep 9, 2026" in English.
  const footerThrough = !status.messagesThrough ? "" : lang === "es" ? fmtDate(status.messagesThrough) : fmtLong(status.messagesThrough, "en-US");
  const maxSignals = Math.max(1, ...opportunities.map((o) => o.signals || 0));
  const activeFilters = (cat ? 1 : 0) + (filter ? 1 : 0);
  const filtering = activeFilters > 0 || q !== "";
  const clearAll = () => { setCat(""); setFilter(""); setQInput(""); setQ(""); };

  const onDelete = (id: string) => {
    if (confirmDel !== id) { setConfirmDel(id); return; }
    setConfirmDel(null);
    startTransition(() => deleteVendor(groupKey, id));
  };

  const pill = (v: Vendor) => mode === "type"
    ? { cls: v.type === "self-promotion" ? "mixed" : v.sentiment || "positive", text: t.type[v.type ?? ""] || t.sent[v.sentiment ?? ""] || t.sent.positive }
    : { cls: v.sentiment || "positive", text: t.sent[v.sentiment ?? ""] || t.sent.positive };

  const opinionButtons = (
    <div className="sent-filter" role="group" aria-label={t.filterLabel}>
      {([["", t.all], ...c.filters] as [string, string][]).map(([val, label]) => (
        <button key={val} type="button" aria-pressed={filter === val} onClick={() => setFilter(val)}>{label}</button>
      ))}
    </div>
  );

  return (
    <div className={`g-root g-${groupKey}`} lang={lang}>
      <div className="wrap">
        {userBar}
        <header className={`top${photoUrl ? " has-photo" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, already sized by WhatsApp */}
          {photoUrl && <img className="gphoto" src={photoUrl} alt="" width={72} height={72} />}
          <div className="eyebrow">{t.eyebrow}{c.eyebrowName}</div>
          <h1>{c.h1[0]}<span>{c.h1[1]}</span></h1>
          <p className="lede">{c.lede}</p>
          <p className="stats">
            <span><b>{vendors.length}</b> {t.vendors}</span>
            <span><b>{cats.length}</b> {t.cats}</span>
            {status.checkedAt && <span>{t.updated} <b>{fmtLong(status.checkedAt, t.locale)}</b></span>}
          </p>
        </header>

        {signedIn && <nav className="tabs" role="tablist" aria-label={t.tabsLabel}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const n = tab === "vendors" ? "opps" : "vendors";
            showTab(n);
            document.getElementById(`tab-btn-${n}`)?.focus();
          }}>
          <button type="button" className="tab" role="tab" id="tab-btn-vendors" aria-controls="tab-vendors" aria-selected={tab === "vendors"} tabIndex={tab === "vendors" ? 0 : -1} onClick={() => showTab("vendors")}>
            {t.tabVendors}<span className="n">{vendors.length}</span>
          </button>
          <button type="button" className="tab" role="tab" id="tab-btn-opps" aria-controls="tab-opps" aria-selected={tab === "opps"} tabIndex={tab === "opps" ? 0 : -1} onClick={() => showTab("opps")}>
            {t.tabOpps}<span className="n">{opportunities.length || ""}</span>
          </button>
        </nav>}

        <div id="tab-vendors" role={signedIn ? "tabpanel" : undefined} aria-labelledby={signedIn ? "tab-btn-vendors" : undefined} hidden={tab !== "vendors"}>
          <div className="toolbar">
            <div className="row">
              <div className="search"><input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={c.placeholder} aria-label={t.searchLabel} enterKeyHint="search" /></div>
              <button type="button" className="filters-btn" onClick={() => sheetRef.current?.showModal()} aria-haspopup="dialog">
                {t.filters}{activeFilters > 0 && <span className="count">{activeFilters}</span>}
              </button>
              <div className="desk-only">{opinionButtons}</div>
            </div>
            <div className="chips desk-only" role="group" aria-label={t.chipsLabel}>
              <button type="button" className="chip" aria-pressed={cat === ""} onClick={() => setCat("")}>{t.allCats}<span className="n">{vendors.length}</span></button>
              {cats.map(([name, n]) => (
                <button key={name} type="button" className="chip" aria-pressed={cat === name} onClick={() => setCat(cat === name ? "" : name)}>{name}<span className="n">{n}</span></button>
              ))}
            </div>
            {filtering && (
              <div className="results" role="status">
                <span>{t.results(shown.length)}{cat && <> · <b>{cat}</b></>}</span>
                <button type="button" className="link" onClick={clearAll}>{t.clear}</button>
              </div>
            )}
          </div>

          <dialog ref={sheetRef} className="sheet" aria-labelledby="sheet-title" onClick={(e) => { if (e.target === e.currentTarget) sheetRef.current?.close(); }}>
            <div className="sheet-inner">
              <div className="sheet-head">
                <h2 id="sheet-title">{t.filters}</h2>
                {activeFilters > 0 && <button type="button" className="link" onClick={() => { setCat(""); setFilter(""); }}>{t.clear}</button>}
              </div>
              <h3>{t.opinion}</h3>
              {opinionButtons}
              <h3>{t.chipsLabel}</h3>
              <ul className="cat-list">
                {([["", vendors.length] as [string, number], ...cats]).map(([name, n]) => (
                  <li key={name || "_all"}>
                    <button type="button" aria-pressed={cat === name} onClick={() => setCat(name)}>
                      <span>{name || t.allCats}</span><span className="n">{n}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="primary sheet-done" onClick={() => sheetRef.current?.close()}>{t.show(shown.length)}</button>
            </div>
          </dialog>

          <main>
            {!vendors.length ? <div className="empty">{t.noVendors}</div>
              : !shown.length ? <div className="empty">{t.noMatch}<br /><button type="button" className="link" onClick={clearAll}>{t.clear}</button></div>
              : grouped.map(([category, items]) => (
                <section className="group" key={category}>
                  <h2>{category}<span className="n">{items.length}</span></h2>
                  <div className="vlist">
                    {items.map((v) => (
                      <VendorRow key={v.id} v={v} t={t} pill={pill(v)} open={openId === v.id}
                        onToggle={() => setOpenId(openId === v.id ? null : v.id)}
                        canDelete={signedIn && v.source === "manual"} confirmDel={confirmDel === v.id} onDelete={() => onDelete(v.id)} />
                    ))}
                  </div>
                </section>
              ))}
          </main>
        </div>

        {signedIn && <section id="tab-opps" role="tabpanel" aria-labelledby="tab-btn-opps" hidden={tab !== "opps"}>
          <div className="opps-head"><p>{t.oppsLede}</p></div>
          <div className="opps">
            {!opportunities.length ? <div className="empty">{t.oppsEmpty}</div> : opportunities.map((o) => (
              <article className="opp" key={o.key}>
                <div className="rank">{o.rank}</div>
                <h3>{o.title}</h3>
                {o.summary && <p className="sum">{o.summary}</p>}
                <div className="demand">
                  <span><b>{o.signals || 0}</b> {t.signals}</span>
                  <span><b>{o.people || 0}</b> {t.people}</span>
                  <span className="bar"><i style={{ width: `${Math.round((100 * (o.signals || 0)) / maxSignals)}%` }} /></span>
                  {o.firstDate && <span>{fmtMonth(o.firstDate, t.locale)}{o.lastDate && o.lastDate.slice(0, 7) !== o.firstDate.slice(0, 7) ? " – " + fmtMonth(o.lastDate, t.locale) : ""}</span>}
                  <span className={`gap ${o.gap || "open"}`}>{t.gap[o.gap] || t.gap.open}</span>
                </div>
                <dl>
                  {o.offer && <><dt>{t.offer}</dt><dd>{o.offer}</dd></>}
                  {o.alternatives && <><dt>{t.alts}</dt><dd>{o.alternatives}</dd></>}
                </dl>
                {o.quotes.length > 0 && (
                  <details>
                    <summary>{t.evidence} ({o.quotes.length})</summary>
                    <ul>{o.quotes.map((qt, i) => <li key={i}><span className="who">{[qt.date && fmtDate(qt.date), qt.who].filter(Boolean).join(" · ")}</span>{qt.text}</li>)}</ul>
                  </details>
                )}
              </article>
            ))}
          </div>
          <p className="opps-method">{t.oppsMethod}</p>
        </section>}

        <footer>{c.footer(c.chatFrom, footerThrough)}</footer>
      </div>
    </div>
  );
}
