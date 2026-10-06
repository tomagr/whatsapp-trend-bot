"use client";

import { useActionState } from "react";
import { renameSlug, type SlugState } from "@/app/actions";

// Renames a group's URL; the old one keeps redirecting. Shown in the /admin group row's "Edit URL" panel.
export default function SlugForm({ groupKey, slug, autoFocus }: { groupKey: string; slug: string; autoFocus?: boolean }) {
  const [state, action, pending] = useActionState(renameSlug, { status: "idle", message: "", slug } satisfies SlugState);
  return (
    <form action={action}>
      <input type="hidden" name="groupKey" value={groupKey} />
      <label>
        <span className="prefix">/</span>
        <input name="slug" defaultValue={state.slug} aria-label="URL slug" autoFocus={autoFocus} required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} />
      </label>
      <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {state.message && <p className={`slug-msg ${state.status}`} role="status">{state.message}</p>}
    </form>
  );
}
