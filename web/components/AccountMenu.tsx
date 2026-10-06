"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutTo as signOutAction } from "@/app/actions";

type Props = { email: string; name: string | null; image: string | null; signOutTo: string };

const initials = (name: string | null, email: string) =>
  (name ?? email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

// The avatar opens a small menu with the account and sign out; Escape or a click outside closes it.
export default function AccountMenu({ email, name, image, signOutTo }: Props) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="acct" ref={ref}>
      <button ref={btn} type="button" className="avatar" aria-expanded={open} aria-controls={menuId} aria-haspopup="true"
        aria-label={`Account: ${email}`} onClick={() => setOpen((o) => !o)}>
        {image && !broken
          ? <Image src={image} alt="" width={36} height={36} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          : <span aria-hidden="true">{initials(name, email)}</span>}
      </button>
      <div className="acct-menu" id={menuId} hidden={!open}>
        <div className="acct-who">
          {name && <span className="acct-name">{name}</span>}
          <span className="acct-email">{email}</span>
        </div>
        <Link href="/admin" onClick={() => setOpen(false)}>Admin</Link>
        <form action={signOutAction.bind(null, signOutTo)}>
          <button type="submit" className="acct-signout">Sign out</button>
        </form>
      </div>
    </div>
  );
}
