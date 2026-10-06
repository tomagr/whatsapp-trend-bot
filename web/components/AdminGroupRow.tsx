"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GroupUpdateButton from "./GroupUpdateButton";
import { RemoveConfirm } from "./GroupRemoveButton";
import { SlugForm } from "./SlugEditor";

type Props = {
  groupKey: string; slug: string; name: string; photoUrl: string | null; style: Record<string, string>; custom: boolean;
  vendors: number; checked: string | null; latest: string | null; updateDisabled: boolean;
};

const initial = (name: string) => [...name.replace(/[^\p{L}\p{N}]/gu, "")][0]?.toUpperCase() ?? "";

// One group in /admin: the name opens its page, Update runs it, and the rarer actions sit behind the ⋯ menu.
export default function AdminGroupRow(p: Props) {
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"url" | "remove" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
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
            <span>{p.checked ? `Checked ${p.checked}` : "First update pending"}</span>
            {p.latest && <span>Latest message {p.latest}</span>}
          </div>
        </div>
        <div className="grp-actions">
          <GroupUpdateButton groupKey={p.groupKey} name={p.name} disabled={p.updateDisabled} />
          <div className="grp-more" ref={menuRef}>
            <button type="button" className="grp-more-btn" aria-label={`More actions for ${p.name}`} aria-haspopup="menu"
              aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="4" cy="10" r="1.7" /><circle cx="10" cy="10" r="1.7" /><circle cx="16" cy="10" r="1.7" /></svg>
            </button>
            {menu && (
              <div className="grp-menu" role="menu">
                <Link role="menuitem" href={`/${p.slug}`}>Open page</Link>
                <button type="button" role="menuitem" onClick={() => open("url")}>Edit URL</button>
                <button type="button" role="menuitem" className="danger-text" onClick={() => open("remove")}>Remove group</button>
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
