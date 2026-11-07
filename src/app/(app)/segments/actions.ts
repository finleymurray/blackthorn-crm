"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { logActivity } from "@/lib/data/activity";
import { createSegment, deleteSegment, getSegment, segmentInputSchema, updateSegment } from "@/lib/data/segments";
import { errorMessage } from "@/lib/utils";

export type SegmentActionResult = { ok: true; id: string } | { ok: false; error: string };

function friendly(err: unknown) {
  return isPermissionError(err) ? "Your role is not allowed to change segments." : errorMessage(err);
}

export async function saveSegment(id: string | null, input: unknown): Promise<SegmentActionResult> {
  const staff = await requireRole("admin", "marketing");
  const parsed = segmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the segment and try again." };
  try {
    const savedId = await withStaff(staff, async (db) => {
      if (id) {
        await updateSegment(db, id, parsed.data);
        await logActivity(db, staff, { action: "segment.updated", entityType: "segment", entityId: id, summary: `Updated segment "${parsed.data.name}"` });
        return id;
      }
      const newId = await createSegment(db, parsed.data, staff.id);
      await logActivity(db, staff, { action: "segment.created", entityType: "segment", entityId: newId, summary: `Created segment "${parsed.data.name}"` });
      return newId;
    });
    revalidatePath("/segments");
    revalidatePath(`/segments/${savedId}`);
    return { ok: true, id: savedId };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function duplicateSegment(id: string): Promise<void> {
  const staff = await requireRole("admin", "marketing");
  const newId = await withStaff(staff, async (db) => {
    const existing = await getSegment(db, id);
    if (!existing) throw new Error("Segment not found");
    const copyId = await createSegment(db, { name: `${existing.name} (copy)`, description: existing.description ?? "", rules: existing.rules }, staff.id);
    await logActivity(db, staff, { action: "segment.duplicated", entityType: "segment", entityId: copyId, summary: `Duplicated segment "${existing.name}"` });
    return copyId;
  });
  revalidatePath("/segments");
  redirect(`/segments/${newId}`);
}

export async function removeSegment(id: string): Promise<SegmentActionResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    await withStaff(staff, async (db) => {
      const existing = await getSegment(db, id);
      if (!existing) throw new Error("Segment not found");
      if (existing.campaign_count > 0) throw new Error("This segment is used by a campaign. Remove it from the campaign first.");
      await deleteSegment(db, id);
      await logActivity(db, staff, { action: "segment.deleted", entityType: "segment", entityId: id, summary: `Deleted segment "${existing.name}"` });
    });
    revalidatePath("/segments");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
