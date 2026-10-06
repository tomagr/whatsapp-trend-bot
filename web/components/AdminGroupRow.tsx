"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import GroupUpdateButton from "./GroupUpdateButton";
import { RemoveConfirm } from "./GroupRemoval";
import SlugForm from "./SlugForm";

type Props = {
  groupKey: string; slug: string; name: string; photoUrl: string | null; style: Record<string, string>; custom: boolean;
  vendors: number; checked: string | null; latest: string | null; updateDisabled: boolean;
};

// The first letter or digit; a name with neither (all emoji) shows its first character, emoji included.
const initial = (name: string) => {
  const first = (s: string) => [...new Intl.Segmenter().segment(s.trim())][0]?.segment ?? "";
  return (first(name.replace(/[^\p{L}\p{N}]/gu, "")) || first(name)).toUpperCase();
};

// One group in /admin: the name opens its page, Update runs it, and the rarer actions sit behind the ⋯ menu.
export default function AdminGroupRow(p: Props) {
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"url" | "remove" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Closes on a click outside, on Escape (focus goes back to ⋯) and when focus leaves the menu (Tab past it).
  useEffect(() => {
    if (!menu) return;
    const outside = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [menu]);

  const open = (which: "url" | "remove") => { setPanel(which); setMenu(false); };

  return (
    <li className={`grp${p.custom ? " custom" : ""}`} style={p.style}>
      <div className="grp-main">
        {p.photoUrl
          ? <Image className="grp-photo" src={p.photoUrl} alt="" width={40} height={40} unoptimized />
          : <span className="grp-photo grp-photo-empty" aria-hidden="true">{initial(p.name)}</span>}
        <div className="grp-text">
          <Link className="grp-name" href={`/${p.slug}`}>{p.name}</Link>
          <div className="grp-meta">
            <span>{p.vendors} {p.vendors === 1 ? "vendor" : "vendors"}</span>
            <span>{p.checked ? `Checked ${p.checked}` : p.custom ? "First update pending" : "Not checked yet"}</span>
            {p.latest && <span>Latest message {p.latest}</span>}
          </div>
        </div>
        <div className="grp-actions">
          <GroupUpdateButton groupKey={p.groupKey} name={p.name} disabled={p.updateDisabled} />
          <div className="grp-more" ref={menuRef}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(false); }}>
            <button type="button" ref={triggerRef} className="grp-more-btn" aria-label={`More actions for ${p.name}`}
              aria-expanded={menu} aria-controls={menuId} onClick={() => setMenu((m) => !m)}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="4" cy="10" r="1.7" /><circle cx="10" cy="10" r="1.7" /><circle cx="16" cy="10" r="1.7" /></svg>
            </button>
            {menu && (
              <div className="grp-menu" id={menuId}>
                <Link href={`/${p.slug}`}>Open page</Link>
                <button type="button" onClick={() => open("url")}>Edit URL</button>
                <button type="button" className="danger-text" onClick={() => open("remove")}>Remove group</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {panel === "url" && (
        <div className="grp-panel">
          <div className="grp-panel-head"><b>Page URL</b><button type="button" className="link" onClick={() => setPanel(null)}>Close</button></div>
          <SlugForm groupKey={p.groupKey} slug={p.slug} autoFocus />
        </div>
      )}
      {panel === "remove" && (
        <div className="grp-panel">
          <RemoveConfirm groupKey={p.groupKey} name={p.name} onCancel={() => setPanel(null)} />
        </div>
      )}
    </li>
  );
}
