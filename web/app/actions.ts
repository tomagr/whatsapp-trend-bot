"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { renameGroupSlug } from "@/lib/slugs";
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
