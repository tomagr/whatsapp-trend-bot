"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import { cancelUpdate, requestUpdate, type UpdateState } from "@/app/actions";

type Active = { id: string; status: string; requestedBy: string; requestedAt: string; startedAt: string | null; scope: string } | null;

// While a request is queued or running, re-read the page every 10 s so the status moves on its own.
export default function UpdatePanel({ active }: { active: Active }) {
  const router = useRouter();
  const [state, run, starting] = useActionState<UpdateState, FormData>(requestUpdate, { status: "idle", message: "" });
  const [canceling, startCancel] = useTransition();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [active, router]);
  return (
    <div className="update" aria-live="polite">
      {active ? (
        <div className={`update-state s-${active.status}`}>
          <span className="spinner" aria-hidden="true" />
          <div>
            <b>{active.status === "running" ? "Running on the Mac" : "Waiting for the Mac"}: {active.scope}</b>
            <p>
              {active.status === "running"
                ? `Started ${active.startedAt}. A run takes up to about an hour, less for a single group.`
                : `Requested ${active.requestedAt} by ${active.requestedBy}. It starts within a minute if the Mac is awake.`}
            </p>
          </div>
          {active.status === "queued" && (
            <button type="button" disabled={canceling} onClick={() => startCancel(() => cancelUpdate(active.id))}>Cancel</button>
          )}
        </div>
      ) : (
        <form action={run} className="update-go">
          <button className="primary" type="submit" disabled={starting}>{starting ? "Queuing…" : "Update data"}</button>
          <p>The update runs on the Mac that hosts the WhatsApp session, so it only starts while that Mac is on and awake.</p>
        </form>
      )}
      {state.status === "error" && <p className="update-error" role="alert">{state.message}</p>}
    </div>
  );
}
