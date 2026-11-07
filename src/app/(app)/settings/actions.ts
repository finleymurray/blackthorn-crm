"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { logActivity } from "@/lib/data/activity";
import {
  categorySchema,
  createSavedReply,
  createStaff,
  deleteSavedReply,
  parkSettingsSchema,
  rootCauseSchema,
  savedReplySchema,
  setCategoryActive,
  setRootCauseActive,
  slaSchema,
  staffSchema,
  updateParkSettings,
  updateSavedReply,
  updateSla,
  updateStaff,
  upsertCategory,
  upsertRootCause,
} from "@/lib/data/admin";
import { errorMessage } from "@/lib/utils";

export type SettingsResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function friendly(err: unknown) {
  if (isPermissionError(err)) return "Only admins can change settings.";
  const code = (err as { code?: string }).code;
  if (code === "23505") return "That already exists.";
  return errorMessage(err);
}
function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

async function run(fn: (staffDb: Parameters<Parameters<typeof withStaff>[1]>[0], staff: Awaited<ReturnType<typeof requireRole>>) => Promise<string | void>, paths: string[]): Promise<SettingsResult> {
  const staff = await requireRole("admin");
  try {
    const message = await withStaff(staff, (db) => fn(db, staff));
    for (const p of paths) revalidatePath(p);
    return { ok: true, message: message ?? undefined };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function saveParkSettings(input: unknown): Promise<SettingsResult> {
  const parsed = parkSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return run(async (db, staff) => {
    await updateParkSettings(db, parsed.data);
    await logActivity(db, staff, { action: "settings.park_updated", entityType: "settings", entityId: "park", summary: "Updated park details" });
    return "Park details saved.";
  }, ["/settings", "/"]);
}

export async function addStaff(input: unknown): Promise<SettingsResult> {
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return run(async (db, staff) => {
    const r = await createStaff(db, parsed.data);
    await logActivity(db, staff, { action: "staff.created", entityType: "staff", entityId: r.id, summary: `Added ${parsed.data.name} as ${parsed.data.role.replace("_", " ")}` });
    return r.authCreated ? `${parsed.data.name} added. They can sign in with the demo password.` : `${parsed.data.name} added.`;
  }, ["/settings/staff", "/login"]);
}

export async function changeStaff(id: string, input: unknown): Promise<SettingsResult> {
  const parsed = z.object({ name: z.string().trim().min(2).max(80).optional(), role: z.enum(["admin", "marketing", "support", "front_desk"]).optional(), active: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid change." };
  return run(async (db, staff) => {
    if (id === staff.id && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "admin"))) throw new Error("You cannot remove your own admin access.");
    await updateStaff(db, id, parsed.data);
    await logActivity(db, staff, { action: "staff.updated", entityType: "staff", entityId: id, summary: `Updated staff member: ${Object.entries(parsed.data).map(([k, v]) => `${k} → ${v}`).join(", ")}` });
    return "Saved.";
  }, ["/settings/staff", "/login"]);
}

export async function saveSavedReply(id: string | null, input: unknown): Promise<SettingsResult> {
  const parsed = savedReplySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return run(async (db, staff) => {
    const replyId = id ? (await updateSavedReply(db, id, parsed.data), id) : await createSavedReply(db, parsed.data);
    await logActivity(db, staff, { action: id ? "saved_reply.updated" : "saved_reply.created", entityType: "saved_reply", entityId: replyId, summary: `${id ? "Updated" : "Created"} saved reply "${parsed.data.title}"` });
    return "Saved reply stored.";
  }, ["/settings/replies"]);
}

export async function removeSavedReply(id: string): Promise<SettingsResult> {
  return run(async (db, staff) => {
    await deleteSavedReply(db, id);
    await logActivity(db, staff, { action: "saved_reply.deleted", entityType: "saved_reply", entityId: id, summary: "Deleted a saved reply" });
    return "Deleted.";
  }, ["/settings/replies"]);
}

export async function saveCategory(input: unknown): Promise<SettingsResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return run(async (db, staff) => {
    await upsertCategory(db, parsed.data);
    await logActivity(db, staff, { action: "settings.category_saved", entityType: "settings", entityId: parsed.data.key, summary: `Saved ticket category "${parsed.data.label}"` });
    return "Category saved.";
  }, ["/settings/support", "/support"]);
}

export async function toggleCategory(key: string, active: boolean): Promise<SettingsResult> {
  return run(async (db, staff) => {
    await setCategoryActive(db, key, active);
    await logActivity(db, staff, { action: "settings.category_toggled", entityType: "settings", entityId: key, summary: `${active ? "Enabled" : "Disabled"} ticket category "${key}"` });
  }, ["/settings/support", "/support"]);
}

export async function saveRootCause(input: unknown): Promise<SettingsResult> {
  const parsed = rootCauseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  return run(async (db, staff) => {
    await upsertRootCause(db, parsed.data);
    await logActivity(db, staff, { action: "settings.root_cause_saved", entityType: "settings", entityId: parsed.data.key, summary: `Saved root cause tag "${parsed.data.label}"` });
    return "Root cause saved.";
  }, ["/settings/support", "/support"]);
}

export async function toggleRootCause(key: string, active: boolean): Promise<SettingsResult> {
  return run(async (db, staff) => {
    await setRootCauseActive(db, key, active);
    await logActivity(db, staff, { action: "settings.root_cause_toggled", entityType: "settings", entityId: key, summary: `${active ? "Enabled" : "Disabled"} root cause "${key}"` });
  }, ["/settings/support", "/support"]);
}

export async function saveSla(input: unknown): Promise<SettingsResult> {
  const parsed = slaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "SLA hours must be whole numbers between 1 and 720.", fieldErrors: fieldErrors(parsed.error) };
  return run(async (db, staff) => {
    await updateSla(db, parsed.data);
    await logActivity(db, staff, { action: "settings.sla_updated", entityType: "settings", entityId: "sla", summary: `SLA hours set to urgent ${parsed.data.urgent}, high ${parsed.data.high}, normal ${parsed.data.normal}, low ${parsed.data.low}`, details: parsed.data });
    return "SLA times saved. Existing tickets keep their current due time.";
  }, ["/settings/support", "/support"]);
}
