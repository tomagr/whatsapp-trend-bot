"use client";

import { useActionState } from "react";
import { renameSlug, type SlugState } from "@/app/actions";

export default function SlugEditor({ groupKey, slug }: { groupKey: string; slug: string }) {
  const [state, action, pending] = useActionState(renameSlug, { status: "idle", message: "", slug } satisfies SlugState);
  return (
    <details className="slug-edit">
      <summary>Edit URL</summary>
      <form action={action}>
        <input type="hidden" name="groupKey" value={groupKey} />
        <label>
          <span className="prefix">/</span>
          <input name="slug" defaultValue={state.slug} aria-label="URL slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} />
        </label>
        <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.message && <p className={`slug-msg ${state.status}`} role="status">{state.message}</p>}
      </form>
    </details>
  );
}
