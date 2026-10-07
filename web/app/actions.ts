"use server";

import { revalidatePath } from "next/cache";
import { requireUser, signOut } from "@/auth";
import { db } from "@/lib/db";
import { addGroup, removeGroup, restoreGroup } from "@/lib/groups";
import { renameGroupSlug } from "@/lib/slugs";
import { cancelRun, requestChatList, requestRun } from "@/lib/updateRuns";
import { createManualVendor, deleteManualVendor } from "@/lib/vendors";

export type AddState = { status: "idle" | "ok" | "error"; message: string; key: number };

export async function addVendor(_prev: AddState, form: FormData): Promise<AddState> {
  await requireUser();
  const raw = Object.fromEntries(["groupKey", "name", "category", "service", "location", "contact", "recommendedBy", "sentiment", "quote"]
    .map((k) => [k, String(form.get(k) ?? "")]));
  try {
    const r = await createManualVendor(db(), raw);
    if (!r.ok) return { status: "error", message: r.field || "invalid", key: Date.now() };
    revalidatePath("/[group]", "page");
    return { status: "ok", message: r.name, key: Date.now() };
  } catch {
    return { status: "error", message: "server", key: Date.now() };
  }
}

export async function deleteVendor(groupKey: string, id: string) {
  await requireUser();
  await deleteManualVendor(db(), id);
  revalidatePath("/[group]", "page");
}

export type SlugState = { status: "idle" | "ok" | "error"; message: string; slug: string };

export async function renameSlug(prev: SlugState, form: FormData): Promise<SlugState> {
  await requireUser();
  const r = await renameGroupSlug(db(), String(form.get("groupKey") ?? ""), String(form.get("slug") ?? ""));
  if (!r.ok) return { status: "error", message: r.error, slug: prev.slug };
  revalidatePath("/", "layout");
  return { status: "ok", message: r.slug === r.previous ? "Unchanged." : `Saved. /${r.previous} now redirects here.`, slug: r.slug };
}

export type UpdateState = { status: "idle" | "ok" | "error"; message: string };

// Queues an update for the Mac poller; the page then shows its progress. A "groupKey" field limits it to one group.
export async function requestUpdate(_prev: UpdateState, form: FormData): Promise<UpdateState> {
  const user = await requireUser();
  const key = String(form.get("groupKey") ?? "");
  if (key && !(await db().group.findFirst({ where: { key, removedAt: null }, select: { key: true } }))) return { status: "error", message: "Unknown group." };
  const r = await requestRun(db(), user.email ?? "unknown", new Date(), key || null);
  revalidatePath("/admin");
  return r.ok ? { status: "ok", message: "Queued." } : { status: "error", message: "An update is already queued or running." };
}

export async function cancelUpdate(id: string) {
  await requireUser();
  await cancelRun(db(), id);
  revalidatePath("/admin");
}

// Signing out keeps the user on public pages (a group) and sends them home otherwise. Only same-site paths.
export async function signOutTo(path: string) {
  await signOut({ redirectTo: /^\/(?![/\\])/.test(path) ? path : "/" });
}

// "Add group": ask the Mac for its current list of WhatsApp groups (the picker re-reads the page until it arrives).
export async function requestChats() {
  const user = await requireUser();
  await requestChatList(db(), user.email ?? "unknown");
  revalidatePath("/admin");
}

export type AddGroupState = { status: "idle" | "ok" | "error"; message: string; slug?: string };

export async function addGroupAction(_prev: AddGroupState, form: FormData): Promise<AddGroupState> {
  const user = await requireUser();
  const field = (k: string) => String(form.get(k) ?? "");
  const r = await addGroup(db(), {
    name: field("name"), lang: field("lang"), vendorMode: field("vendorMode"), context: field("context"),
  }, user.email ?? "unknown");
  if (!r.ok) return { status: "error", message: r.error };
  revalidatePath("/", "layout");
  return { status: "ok", message: `Added ${r.group.name}. Its first update is queued.`, slug: r.group.slug };
}

// Takes a group's page offline and stops processing it; "Restore" in /admin undoes it.
export async function removeGroupAction(key: string) {
  const user = await requireUser();
  await removeGroup(db(), key, user.email ?? "unknown");
  revalidatePath("/", "layout");
}

export async function restoreGroupAction(key: string) {
  await requireUser();
  await restoreGroup(db(), key);
  revalidatePath("/", "layout");
}
