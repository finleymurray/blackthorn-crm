"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { logActivity } from "@/lib/data/activity";
import { automationInputSchema, getAutomation, runAutomationNow, setAutomationActive, simulateAutomation, updateAutomation, type SimulatedSend } from "@/lib/data/automations";
import { errorMessage } from "@/lib/utils";

export type AutomationResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function friendly(err: unknown) {
  return isPermissionError(err) ? "Your role is not allowed to change automations." : errorMessage(err);
}

export async function toggleAutomation(id: string, active: boolean): Promise<AutomationResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    await withStaff(staff, async (db) => {
      const a = await getAutomation(db, id);
      if (!a) throw new Error("Automation not found");
      await setAutomationActive(db, id, active);
      await logActivity(db, staff, { action: active ? "automation.enabled" : "automation.disabled", entityType: "automation", entityId: id, summary: `${active ? "Switched on" : "Switched off"} "${a.name}"` });
    });
    revalidatePath("/automations");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function saveAutomation(id: string, input: unknown): Promise<AutomationResult> {
  const staff = await requireRole("admin", "marketing");
  const parsed = automationInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  try {
    await withStaff(staff, async (db) => {
      await updateAutomation(db, id, parsed.data);
      await logActivity(db, staff, { action: "automation.updated", entityType: "automation", entityId: id, summary: `Edited "${parsed.data.name}"` });
    });
    revalidatePath("/automations");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function simulate(id: string): Promise<{ ok: true; total: number; sample: SimulatedSend[]; explanation: string } | { ok: false; error: string }> {
  const staff = await requireRole("admin", "marketing");
  try {
    const result = await withStaff(staff, async (db) => {
      const a = await getAutomation(db, id);
      if (!a) throw new Error("Automation not found");
      return simulateAutomation(db, a);
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function runNow(id: string): Promise<AutomationResult> {
  const staff = await requireRole("admin", "marketing");
  try {
    const n = await withStaff(staff, async (db) => {
      const a = await getAutomation(db, id);
      if (!a) throw new Error("Automation not found");
      const count = await runAutomationNow(db, a);
      await logActivity(db, staff, { action: "automation.ran", entityType: "automation", entityId: id, summary: `Ran "${a.name}" against the current data: ${count} messages written to the outbox` });
      return count;
    });
    revalidatePath("/automations");
    revalidatePath("/outbox");
    return { ok: true, message: `${n} message${n === 1 ? "" : "s"} written to the outbox.` };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
