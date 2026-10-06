"use client";

import { useState, useTransition } from "react";
import { removeGroupAction, restoreGroupAction } from "@/app/actions";

// Two steps, so a stray click never takes a page offline. Restoring is one click from the "Removed groups" list.
export function GroupRemoveButton({ groupKey, name }: { groupKey: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  if (!confirming) {
    return <div className="group-remove"><button type="button" className="link" onClick={() => setConfirming(true)}>Remove group</button></div>;
  }
  return (
    <div className="group-remove" role="group" aria-label={`Remove ${name}`}>
      <p>Remove {name}? Its page goes offline and the Mac stops reading it. Nothing is deleted; you can restore it below.</p>
      <button type="button" className="danger" disabled={pending} onClick={() => start(() => removeGroupAction(groupKey))}>{pending ? "Removing…" : "Remove"}</button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
    </div>
  );
}

export function GroupRestoreButton({ groupKey }: { groupKey: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => restoreGroupAction(groupKey))}>{pending ? "Restoring…" : "Restore"}</button>;
}
