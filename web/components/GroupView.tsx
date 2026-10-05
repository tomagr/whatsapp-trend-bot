"use client";

// Port of the artifact group page (artifact/proveedores.html), driven by server data instead of window.claude.
import { useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { addVendor, deleteVendor, type AddState } from "@/app/actions";
import { categoryCounts, fmtDate, fmtLong, fmtMonth, groupByCategory, matches, splitContact, type ListVendor } from "@/lib/filter";
import { COPY, T, type GroupKey } from "@/lib/groupCopy";

type Vendor = ListVendor & { id: string; note: string; dates: string[]; source: string };
type Opp = { key: string; rank: number; title: string; summary: string; offer: string; alternatives: string; gap: string;
  signals: number; people: number; firstDate: string; lastDate: string; quotes: { date?: string; who?: string; text?: string }[] };
type Props = { userBar?: React.ReactNode; groupKey: GroupKey; lang: "es" | "en"; mode: "sentiment" | "type";
  status: { checkedAt: string | null; messagesThrough: string | null }; vendors: Vendor[]; opportunities: Opp[] };

const initial: AddState = { status: "idle", message: "", key: 0 };

// "#oportunidades" / "#opportunities" in the URL opens the second tab, as on the original pages.
const subscribeHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const hashWantsOpps = () => /oportunidades|opportunities/.test(window.location.hash);

export default function GroupView({ userBar, groupKey, lang, mode, status, vendors, opportunities }: Props) {
  const t = T[lang];
  const c = COPY[groupKey];
  const [tabChoice, setTab] = useState<"vendors" | "opps" | null>(null);
  const fromHash = useSyncExternalStore(subscribeHash, hashWantsOpps, () => false);
  const tab = tabChoice ?? (fromHash ? "opps" : "vendors");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [cat, setCat] = useState("");
  const [filter, setFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [addState, addAction, adding] = useActionState(addVendor, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const id = setTimeout(() => setQ(qInput.trim()), 120); return () => clearTimeout(id); }, [qInput]);
  useEffect(() => { if (addState.status === "ok") formRef.current?.reset(); }, [addState]);
  useEffect(() => { if (addOpen) nameRef.current?.focus(); }, [addOpen]);

  const showTab = (which: "vendors" | "opps") => {
    setTab(which);
    try { history.replaceState(null, "", which === "opps" ? t.hashOpps : t.hashVendors); } catch {}
  };
  const cats = useMemo(() => categoryCounts(vendors, t.locale), [vendors, t.locale]);
  const shown = useMemo(() => vendors.filter((v) => matches(v, q, cat, mode, filter)), [vendors, q, cat, mode, filter]);
  const grouped = useMemo(() => groupByCategory(shown, t.locale), [shown, t.locale]);
  const through = fmtLong(status.messagesThrough, t.locale);
  // The footer keeps the original pages' date style: DD/MM/YYYY in Spanish, "Sep 9, 2026" in English.
  const footerThrough = !status.messagesThrough ? "" : lang === "es" ? fmtDate(status.messagesThrough) : fmtLong(status.messagesThrough, "en-US");
  const maxSignals = Math.max(1, ...opportunities.map((o) => o.signals || 0));
  const msg = addState.status === "ok" ? t.saved(addState.message)
    : addState.status === "error" ? (addState.message === "server" ? t.saveErr : t.fieldErr) : "";

  const onDelete = (id: string) => {
    if (confirmDel !== id) { setConfirmDel(id); return; }
    setConfirmDel(null);
    startTransition(() => deleteVendor(groupKey, id));
  };

  const pill = (v: Vendor) => mode === "type"
    ? { cls: v.type === "self-promotion" ? "mixed" : v.sentiment || "positive", text: t.type[v.type ?? ""] || t.sent[v.sentiment ?? ""] || t.sent.positive }
    : { cls: v.sentiment || "positive", text: t.sent[v.sentiment ?? ""] || t.sent.positive };

  return (
    <div className={`g-root g-${groupKey}`} lang={lang}>
      <div className="wrap">
        {userBar}
        <header className="top">
          <div className="eyebrow">{t.eyebrow}{c.eyebrowName}</div>
          <h1>{c.h1[0]}<span>{c.h1[1]}</span></h1>
          <p className="lede">{c.lede}</p>
          <div className="stats">
            <span><b>{vendors.length}</b> {t.vendors}</span>
            <span><b>{cats.length}</b> {t.cats}</span>
            <span>{t.chat[0]}<b>{c.chatFrom}</b>{t.chat[1]}<b>{through}</b></span>
            {status.checkedAt && <span>{t.updated} <b>{fmtLong(status.checkedAt, t.locale)}</b></span>}
          </div>
        </header>

        <nav className="tabs" role="tablist" aria-label={t.tabsLabel}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const n = tab === "vendors" ? "opps" : "vendors";
            showTab(n);
            document.getElementById(`tab-btn-${n}`)?.focus();
          }}>
          <button type="button" className="tab" role="tab" id="tab-btn-vendors" aria-controls="tab-vendors" aria-selected={tab === "vendors"} onClick={() => showTab("vendors")}>
            {t.tabVendors}<span className="n">{vendors.length}</span>
          </button>
          <button type="button" className="tab" role="tab" id="tab-btn-opps" aria-controls="tab-opps" aria-selected={tab === "opps"} onClick={() => showTab("opps")}>
            {t.tabOpps}<span className="n">{opportunities.length || ""}</span>
          </button>
        </nav>

        <div id="tab-vendors" role="tabpanel" aria-labelledby="tab-btn-vendors" hidden={tab !== "vendors"}>
          <div className="toolbar">
            <div className="row">
              <div className="search"><input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={c.placeholder} aria-label={t.searchLabel} /></div>
              <div className="sent-filter" role="group" aria-label={t.filterLabel}>
                {([["", t.all], ...c.filters] as [string, string][]).map(([val, label]) => (
                  <button key={val} type="button" aria-pressed={filter === val} onClick={() => setFilter(val)}>{label}</button>
                ))}
              </div>
              <button type="button" className="primary" onClick={() => setAddOpen((o) => !o)}>{t.add}</button>
            </div>
            <div className="chips" role="group" aria-label={t.chipsLabel}>
              <button type="button" className="chip" aria-pressed={cat === ""} onClick={() => setCat("")}>{t.allCats}<span className="n">{vendors.length}</span></button>
              {cats.map(([name, n]) => (
                <button key={name} type="button" className="chip" aria-pressed={cat === name} onClick={() => setCat(cat === name ? "" : name)}>{name}<span className="n">{n}</span></button>
              ))}
            </div>
          </div>

          <section className="add-panel" hidden={!addOpen}>
            <h3>{t.addTitle}</h3>
            <p>{c.addNote}</p>
            <form className="form" ref={formRef} action={addAction} autoComplete="off">
              <input type="hidden" name="groupKey" value={groupKey} />
              <label>{t.f.name}<input ref={nameRef} name="name" required maxLength={120} /></label>
              <label>{t.f.cat}<input name="category" required maxLength={60} list="cat-list" placeholder={c.catPlaceholder} /></label>
              <label className="full">{t.f.service}<input name="service" required maxLength={300} /></label>
              <label>{t.f.loc}<input name="location" maxLength={120} placeholder={t.f.locPh} /></label>
              <label>{t.f.contact}<input name="contact" maxLength={200} placeholder={t.f.contactPh} /></label>
              <label>{t.f.by}<input name="recommendedBy" maxLength={120} placeholder={t.f.byPh} /></label>
              <label>{t.f.sent}
                <select name="sentiment" defaultValue="positive">
                  {(["positive", "mixed", "negative"] as const).map((s) => <option key={s} value={s}>{t.sent[s]}</option>)}
                </select>
              </label>
              <label className="full">{t.f.quote}<textarea name="quote" rows={2} maxLength={400} placeholder={c.quotePlaceholder} /></label>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={adding}>{t.save}</button>
                <button type="button" onClick={() => { setAddOpen(false); formRef.current?.reset(); }}>{t.cancel}</button>
                <span className={`msg${addState.status === "error" ? " err" : ""}`} role="status">{adding ? t.saving : msg}</span>
              </div>
            </form>
            <datalist id="cat-list">{cats.map(([name]) => <option key={name} value={name} />)}</datalist>
          </section>

          <main>
            {!vendors.length ? <div className="empty">{t.noVendors}</div>
              : !shown.length ? <div className="empty">{t.noMatch}</div>
              : grouped.map(([category, items]) => (
                <section className="group" key={category}>
                  <h2>{category}<span className="n">{items.length}</span></h2>
                  <div className="list">
                    {items.map((v) => {
                      const p = pill(v);
                      return (
                        <article className="item" key={v.id}>
                          <div>
                            <div className="name">{v.name}{v.source === "manual" && <span className="badge-new">{t.badge}</span>}</div>
                            <div className="service">{v.service}</div>
                          </div>
                          <div className="meta">
                            {v.location && <><span className="k">{t.where}</span><span>{v.location}</span></>}
                            {v.contact && <><span className="k">{t.contact}</span><span>{splitContact(v.contact).map((part, i) =>
                              "href" in part ? <a key={i} href={part.href} target="_blank" rel="noopener">{part.text}</a> : <span key={i}>{part.text}</span>)}</span></>}
                          </div>
                          <div className="meta">
                            {v.recommendedBy && <><span className="k">{t.recBy(v.type)}</span><span>{v.recommendedBy}</span></>}
                          </div>
                          <div className="side">
                            <span className={`pill ${p.cls}`}>{p.text}</span>
                            <span className="mentions"><b>{v.mentions || 1}</b>{t.mention(v.mentions || 1)}</span>
                            {v.source === "manual" && <button type="button" className="del" onClick={() => onDelete(v.id)}>{confirmDel === v.id ? t.delSure : t.del}</button>}
                          </div>
                          {v.note && <div className="note">{v.note}</div>}
                          {(v.quote || v.dates.length > 0) && (
                            <details className="quote">
                              <summary>{t.said}</summary>
                              {v.quote && <blockquote>{v.quote}</blockquote>}
                              {v.dates.length > 0 && <div className="dates">{t.dates(v.dates.length) + v.dates.map(fmtDate).join(" · ")}</div>}
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
          </main>
        </div>

        <section id="tab-opps" role="tabpanel" aria-labelledby="tab-btn-opps" hidden={tab !== "opps"}>
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
        </section>

        <footer>{c.footer(c.chatFrom, footerThrough)}</footer>
      </div>
    </div>
  );
}
