"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { addGroupAction, requestChats, type AddGroupState } from "@/app/actions";

type Chat = { id: string; name: string; t: number; archived?: boolean };
type Props = { offer: { fetchedAt: string; chats: Chat[] } | null; pending: boolean; failed: string | null };

// A list older than this is asked for again when the panel opens.
const FRESH_MS = 15 * 60 * 1000;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ago = (t: number) => {
  const d = Math.round((Date.now() / 1000 - t) / 86400);
  return !t ? "" : d <= 0 ? "today" : d === 1 ? "yesterday" : d < 60 ? `${d} days ago` : `${Math.round(d / 30)} months ago`;
};

// "Add group": the 10 WhatsApp groups with the newest messages, or a search over all of them, then a short form.
export default function AddGroupPanel({ offer, pending, failed }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Chat | null>(null);
  const [asking, startAsking] = useTransition();
  const [state, add, adding] = useActionState<AddGroupState, FormData>(addGroupAction, { status: "idle", message: "" });
  const ask = () => startAsking(async () => { await requestChats(); router.refresh(); });
  const show = () => {
    setOpen(true);
    const stale = !offer || Date.now() - new Date(offer.fetchedAt).getTime() > FRESH_MS;
    if (stale && !pending) ask();
  };

  // While the Mac is reading the list, re-read the page every 5 s.
  useEffect(() => {
    if (!open || !pending) return;
    const id = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(id);
  }, [open, pending, router]);

  const shown = useMemo(() => {
    const chats = offer?.chats ?? [];
    if (!q.trim()) return chats.slice(0, 10);
    const f = fold(q.trim());
    return chats.filter((c) => fold(c.name).includes(f)).slice(0, 30);
  }, [offer, q]);

  if (!open) return <button type="button" className="btn add-group-btn" onClick={show}>+ Add group</button>;

  if (state.status === "ok") {
    return (
      <div className="add-group">
        <p className="add-done">{state.message} The page fills in once the Mac finishes it.</p>
        <div className="add-actions">
          {state.slug && <Link className="btn" href={`/${state.slug}`}>Open the page →</Link>}
          <button type="button" onClick={() => location.reload()}>Add another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="add-group">
      <div className="add-head">
        <h3>Add a WhatsApp group</h3>
        <button type="button" className="link" onClick={() => { setOpen(false); setPicked(null); }}>Close</button>
      </div>

      {picked ? (
        <form action={add} className="add-form">
          <input type="hidden" name="name" value={picked.name} />
          <p className="add-picked"><b>{picked.name}</b> <button type="button" className="link" onClick={() => setPicked(null)}>Change</button></p>
          <fieldset>
            <legend>Language of the page</legend>
            <label><input type="radio" name="lang" value="es" defaultChecked /> Español</label>
            <label><input type="radio" name="lang" value="en" /> English</label>
          </fieldset>
          <label className="field">
            <span>What is the group about?</span>
            <textarea name="context" required minLength={10} maxLength={600} rows={3}
              placeholder="e.g. Parents of a 3rd grade class in Buenos Aires: birthdays, school supplies, after-school activities." />
            <small>Given to the model that reads the chat, so it knows what counts as a vendor here.</small>
          </label>
          <label className="field">
            <span>How are vendors mentioned?</span>
            <select name="vendorMode" defaultValue="sentiment">
              <option value="sentiment">People share experiences with vendors (good or with caveats)</option>
              <option value="type">Members recommend companies or introduce their own</option>
            </select>
          </label>
          <p className="add-note">Claude writes the page description after the first update. Logged-out visitors never see who recommended a vendor.</p>
          {state.status === "error" && <p className="update-error" role="alert">{state.message}</p>}
          <button className="primary" type="submit" disabled={adding}>{adding ? "Adding…" : "Add group and run its first update"}</button>
        </form>
      ) : (
        <>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all your WhatsApp groups…" aria-label="Search WhatsApp groups" disabled={!offer} />
          {(pending || asking) && (
            <p className="add-wait"><span className="spinner" aria-hidden="true" /> Asking the Mac for your WhatsApp groups. This takes about a minute, longer if an update is running.</p>
          )}
          {failed && !pending && <p className="update-error" role="alert">{failed}</p>}
          {offer && (
            <>
              <p className="add-hint">{q.trim() ? `${shown.length} match${shown.length === 1 ? "" : "es"}` : "Most recently active"}{" · "}
                list from {new Date(offer.fetchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{" "}
                {!pending && <button type="button" className="link" onClick={ask} disabled={asking}>Refresh</button>}
              </p>
              <ul className="chat-list">
                {shown.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setPicked(c)}>
                      <span className="chat-name">{c.name}{c.archived && <span className="chat-tag">archived</span>}</span>
                      <span className="chat-when">{ago(c.t)}</span>
                    </button>
                  </li>
                ))}
                {!shown.length && <li className="muted">No group matches “{q}”.</li>}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
