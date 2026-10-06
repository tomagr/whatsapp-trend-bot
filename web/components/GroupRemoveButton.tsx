"use client";

import { useTransition } from "react";
import { removeGroupAction, restoreGroupAction } from "@/app/actions";

// Two steps (the ⋯ menu, then this), so a stray click never takes a page offline. Restoring is one click from the
// "Removed groups" list.
export function RemoveConfirm({ groupKey, name, onCancel }: { groupKey: string; name: string; onCancel: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="group-remove" role="group" aria-label={`Remove ${name}`}>
      <p>Remove {name}? Its page goes offline and the Mac stops reading it. Nothing is deleted; you can restore it below.</p>
      <button type="button" className="danger" disabled={pending} onClick={() => start(() => removeGroupAction(groupKey))}>{pending ? "Removing…" : "Remove"}</button>
      <button type="button" disabled={pending} onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function GroupRestoreButton({ groupKey }: { groupKey: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(() => restoreGroupAction(groupKey))}>{pending ? "Restoring…" : "Restore"}</button>;
}
