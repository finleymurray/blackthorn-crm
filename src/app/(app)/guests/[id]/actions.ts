"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { logActivity } from "@/lib/data/activity";
import {
  appendNote,
  consentSchema,
  getGuest,
  guestDetailsSchema,
  noteSchema,
  tagsSchema,
  updateConsent,
  updateGuestDetails,
  updateTags,
} from "@/lib/data/guests";
import { canEditGuests } from "@/lib/auth/types";
import { errorMessage } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function friendly(err: unknown): string {
  if (isPermissionError(err)) return "Your role is not allowed to make this change.";
  const code = (err as { code?: string }).code;
  if (code === "23505") return "Another guest already uses that email address.";
  return errorMessage(err);
}

export async function saveGuestDetails(guestId: string, input: unknown): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!canEditGuests(staff.role)) return { ok: false, error: "Your role is not allowed to edit guests." };
  const parsed = guestDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    await withStaff(staff, async (db) => {
      const before = await getGuest(db, guestId);
      if (!before) throw new Error("Guest not found");
      const after = await updateGuestDetails(db, guestId, parsed.data);
      const changed: string[] = [];
      for (const key of ["first_name", "last_name", "email", "phone", "postcode", "date_of_birth", "accessibility_needs", "do_not_touch", "banned", "banned_reason"] as const) {
        if (String(before[key] ?? "") !== String(after[key] ?? "")) changed.push(key.replace(/_/g, " "));
      }
      await logActivity(db, staff, {
        action: "guest.updated",
        entityType: "guest",
        entityId: guestId,
        summary: changed.length ? `Updated ${changed.join(", ")}` : "Saved guest details (no changes)",
        details: { changed },
      });
    });
    revalidatePath(`/guests/${guestId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function setGuestConsent(guestId: string, input: unknown): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!canEditGuests(staff.role)) return { ok: false, error: "Your role is not allowed to change consent." };
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid consent change." };
  try {
    await withStaff(staff, async (db) => {
      await updateConsent(db, guestId, parsed.data);
      await logActivity(db, staff, {
        action: "guest.consent_updated",
        entityType: "guest",
        entityId: guestId,
        summary: `${parsed.data.channel === "email" ? "Email" : "SMS"} marketing consent ${parsed.data.value ? "given" : "withdrawn"} (source: ${parsed.data.source})`,
        details: parsed.data,
      });
    });
    revalidatePath(`/guests/${guestId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function saveGuestTags(guestId: string, input: unknown): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!canEditGuests(staff.role)) return { ok: false, error: "Your role is not allowed to edit tags." };
  const parsed = tagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tags." };
  try {
    await withStaff(staff, async (db) => {
      const before = (await getGuest(db, guestId))?.tags ?? [];
      const after = await updateTags(db, guestId, parsed.data);
      const added = after.filter((t) => !before.includes(t));
      const removed = before.filter((t) => !after.includes(t));
      const parts = [];
      if (added.length) parts.push(`added ${added.map((t) => `"${t}"`).join(", ")}`);
      if (removed.length) parts.push(`removed ${removed.map((t) => `"${t}"`).join(", ")}`);
      await logActivity(db, staff, {
        action: "guest.tags_updated",
        entityType: "guest",
        entityId: guestId,
        summary: parts.length ? `Tags: ${parts.join("; ")}` : "Tags unchanged",
        details: { added, removed },
      });
    });
    revalidatePath(`/guests/${guestId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function addGuestNote(guestId: string, input: unknown): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!canEditGuests(staff.role)) return { ok: false, error: "Your role is not allowed to add notes." };
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note." };
  try {
    await withStaff(staff, async (db) => {
      await appendNote(db, guestId, parsed.data.note, staff.name);
      await logActivity(db, staff, {
        action: "guest.note_added",
        entityType: "guest",
        entityId: guestId,
        summary: `Added a note: ${parsed.data.note.length > 80 ? parsed.data.note.slice(0, 80) + "…" : parsed.data.note}`,
        details: { note: parsed.data.note },
      });
    });
    revalidatePath(`/guests/${guestId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
