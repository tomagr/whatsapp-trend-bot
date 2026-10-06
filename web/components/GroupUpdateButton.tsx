"use client";

import { useActionState } from "react";
import { requestUpdate, type UpdateState } from "@/app/actions";

// "Update" on one group in /admin. Disabled while any run is queued or running: the Mac does one at a time.
export default function GroupUpdateButton({ groupKey, name, disabled }: { groupKey: string; name: string; disabled: boolean }) {
  const [state, run, starting] = useActionState<UpdateState, FormData>(requestUpdate, { status: "idle", message: "" });
  return (
    <form action={run} className="group-update">
      <input type="hidden" name="groupKey" value={groupKey} />
      <button type="submit" disabled={disabled || starting} aria-label={`Update ${name}`}>{starting ? "Queuing…" : "Update"}</button>
      {state.status === "error" && <span className="update-error" role="alert">{state.message}</span>}
    </form>
  );
}
