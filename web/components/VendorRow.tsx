"use client";

import { useState } from "react";
import { contactActions } from "@/lib/contact";
import { fmtDate } from "@/lib/filter";
import type { T } from "@/lib/groupCopy";

export type Vendor = { id: string; name: string; category: string; service: string; location: string; contact: string;
  recommendedBy: string; note: string; quote: string; mentions: number; sentiment: string | null; type: string | null;
  dates: string[]; source: string };

type Props = { v: Vendor; t: (typeof T)["es" | "en"]; pill: { cls: string; text: string }; open: boolean; onToggle: () => void;
  canDelete: boolean; confirmDel: boolean; onDelete: () => void };

// Collapsed: two scannable lines. Expanded (one at a time): quote, dates, note, contact actions, delete.
export default function VendorRow({ v, t, pill, open, onToggle, canDelete, confirmDel, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const { actions, inGroup } = contactActions(v.contact);
  const panelId = `v-${v.id}`;
  const mentions = v.mentions || 1;
  const copy = async () => {
    try { await navigator.clipboard.writeText(v.contact); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  };
  return (
    <article className={`vrow${open ? " open" : ""}`} id={`vendor-${v.id}`}>
      <button type="button" className="vrow-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className="vrow-main">
          <span className="vrow-name">{v.name}{v.source === "manual" && <span className="badge-new">{t.badge}</span>}</span>
          <span className="vrow-service">{v.service}</span>
          <span className="vrow-meta">
            {v.location && <span className="loc-inline">📍 {v.location}</span>}
            {v.recommendedBy && <span>{t.by} {v.recommendedBy}</span>}
            {mentions > 1 && <span className="vrow-x">{mentions}×</span>}
          </span>
        </span>
        <span className="loc-col">{v.location}</span>
        <span className={`dot ${pill.cls}`} title={pill.text}><span className="sr-only">{pill.text}</span></span>
        <span className="chev" aria-hidden="true">›</span>
      </button>
      <div className="vrow-body" id={panelId} hidden={!open}>
        <div className="vrow-tags">
          <span className={`pill ${pill.cls}`}>{pill.text}</span>
          <span className="mentions"><b>{mentions}</b>{t.mention(mentions)}</span>
        </div>
        {v.quote && (
          <figure className="vquote">
            <blockquote>{v.quote}</blockquote>
            <figcaption>{[v.recommendedBy && `${t.recBy(v.type)} ${v.recommendedBy}`, v.dates.map(fmtDate).join(" · ")].filter(Boolean).join(" · ")}</figcaption>
          </figure>
        )}
        {v.note && <p className="note">{v.note}</p>}
        {v.contact && (
          <div className="vcontact">
            {!actions.length && <p className="vcontact-text">{v.contact}</p>}
            {inGroup && <p className="vcontact-hint">{t.askGroup}</p>}
            <div className="vactions">
              {actions.map((a) => (
                <a key={a.href} className={`act act-${a.kind}`} href={a.href} target={a.kind === "call" || a.kind === "email" ? undefined : "_blank"} rel="noopener noreferrer">
                  {a.kind === "call" ? `${t.call} ${a.label}` : a.label}
                </a>
              ))}
              <button type="button" className="act act-copy" onClick={copy}>{copied ? t.copied : t.copy}</button>
            </div>
          </div>
        )}
        {canDelete && <button type="button" className="del" onClick={onDelete}>{confirmDel ? t.delSure : t.del}</button>}
      </div>
    </article>
  );
}
