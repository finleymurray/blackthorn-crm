"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { logActivity } from "@/lib/data/activity";
import {
  campaignInputSchema,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaign,
  scheduleCampaign,
  sendCampaignNow,
  sendTest,
  unscheduleCampaign,
  updateCampaign,
} from "@/lib/data/campaigns";
import { errorMessage } from "@/lib/utils";

export type CampaignActionResult = { ok: true; id: string; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function friendly(err: unknown) {
  return isPermissionError(err) ? "Your role is not allowed to change campaigns." : errorMessage(err);
}

export async function saveCampaign(id: string | null, input: unknown): Promise<CampaignActionResult> {
  const staff = await requireRole("admin", "marketing");
  const parsed = campaignInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the campaign and try again.", fieldErrors };
  }
  try {
    const savedId = await withStaff(staff, async (db) => {
      if (id) {
        await updateCampaign(db, id, parsed.data);
        await logActivity(db, staff, { action: "campaign.updated", entityType: "campaign", entityId: id, summary: `Updated campaign "${parsed.data.name}"` });
        return id;
      }
      const newId = await createCampaign(db, parsed.data, staff.id);
      await logActivity(db, staff, { action: "campaign.created", entityType: "campaign", entityId: newId, summary: `Created campaign "${parsed.data.name}"` });
      return newId;
    });
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${savedId}`);
    return { ok: true, id: savedId };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function sendCampaignTest(id: string): Promise<CampaignActionResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    const outboxId = await withStaff(staff, async (db) => {
      const c = await getCampaign(db, id);
      if (!c) throw new Error("Campaign not found");
      const to = c.channel === "email" ? staff.email : "07700 900000";
      const outboxId = await sendTest(db, c, to, staff.name);
      await logActivity(db, staff, { action: "campaign.test_sent", entityType: "campaign", entityId: id, summary: `Sent a test of "${c.name}" to ${to}` });
      return outboxId;
    });
    revalidatePath("/outbox");
    return { ok: true, id: outboxId, message: "Test message written to the outbox." };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function sendCampaign(id: string): Promise<CampaignActionResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    const stats = await withStaff(staff, async (db) => {
      const c = await getCampaign(db, id);
      if (!c) throw new Error("Campaign not found");
      const stats = await sendCampaignNow(db, c);
      await logActivity(db, staff, {
        action: "campaign.sent",
        entityType: "campaign",
        entityId: id,
        summary: `Sent campaign "${c.name}" to ${stats.recipients} guests (${stats.excluded} excluded)`,
        details: stats as Record<string, unknown>,
      });
      return stats;
    });
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    revalidatePath("/outbox");
    return { ok: true, id, message: `Sent to ${stats.recipients} guests. ${stats.excluded} excluded for consent.` };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

const scheduleSchema = z.object({ when: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) });

export async function scheduleCampaignAction(id: string, input: unknown): Promise<CampaignActionResult> {
  const staff = await requireRole("admin", "marketing");
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a date and time." };
  const when = new Date(parsed.data.when);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) return { ok: false, error: "Pick a time in the future." };
  try {
    await withStaff(staff, async (db) => {
      const c = await getCampaign(db, id);
      if (!c) throw new Error("Campaign not found");
      await scheduleCampaign(db, c, when);
      await logActivity(db, staff, { action: "campaign.scheduled", entityType: "campaign", entityId: id, summary: `Scheduled "${c.name}" for ${when.toLocaleString("en-GB", { timeZone: "Europe/London" })}` });
    });
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    return { ok: true, id, message: "Campaign scheduled." };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function unscheduleCampaignAction(id: string): Promise<CampaignActionResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    await withStaff(staff, async (db) => {
      await unscheduleCampaign(db, id);
      await logActivity(db, staff, { action: "campaign.unscheduled", entityType: "campaign", entityId: id, summary: "Moved campaign back to draft" });
    });
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${id}`);
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function duplicateCampaignAction(id: string): Promise<void> {
  const staff = await requireRole("admin", "marketing");
  const newId = await withStaff(staff, async (db) => {
    const copy = await duplicateCampaign(db, id, staff.id);
    await logActivity(db, staff, { action: "campaign.duplicated", entityType: "campaign", entityId: copy, summary: "Duplicated a campaign" });
    return copy;
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${newId}`);
}

export async function deleteCampaignAction(id: string): Promise<CampaignActionResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    await withStaff(staff, async (db) => {
      const c = await getCampaign(db, id);
      if (!c) throw new Error("Campaign not found");
      await deleteCampaign(db, id);
      await logActivity(db, staff, { action: "campaign.deleted", entityType: "campaign", entityId: id, summary: `Deleted campaign "${c.name}"` });
    });
    revalidatePath("/campaigns");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
