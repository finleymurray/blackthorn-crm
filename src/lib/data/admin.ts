import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Db } from "@/lib/db/client";
import type { StaffRole } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Park details
// ---------------------------------------------------------------------------
export const parkSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  logo_url: z.string().trim().url("Enter a full URL, or leave blank").max(500).optional().or(z.literal("")),
  sender_name: z.string().trim().min(2).max(80),
  sender_email: z.string().trim().email().max(120),
  support_email: z.string().trim().email().max(120),
  sms_sender: z.string().trim().min(2, "SMS sender IDs are 2 to 11 characters").max(11, "SMS sender IDs are 2 to 11 characters").regex(/^[A-Za-z0-9 ]+$/, "Letters and numbers only"),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  website: z.string().trim().url("Enter a full URL").max(200),
});

export async function updateParkSettings(db: Db, input: z.infer<typeof parkSettingsSchema>) {
  await db`update public.park_settings set name = ${input.name}, tagline = ${input.tagline || ""}, logo_url = ${input.logo_url || null}, sender_name = ${input.sender_name},
    sender_email = ${input.sender_email}, support_email = ${input.support_email}, sms_sender = ${input.sms_sender}, address = ${input.address || ""}, website = ${input.website} where id = 1`;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
export interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: Date;
  last_action_at: Date | null;
  actions_30d: number;
}

export async function listStaff(db: Db): Promise<StaffRow[]> {
  return db<StaffRow[]>`
    select s.id, s.name, s.email, s.role::text as role, s.active, s.created_at,
      (select max(created_at) from public.activity_log a where a.staff_id = s.id) as last_action_at,
      (select count(*) from public.activity_log a where a.staff_id = s.id and a.created_at > now() - interval '30 days')::int as actions_30d
    from public.staff_users s order by s.active desc, s.name`;
}

export const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.string().trim().email("Enter a valid email address").max(120),
  role: z.enum(["admin", "marketing", "support", "front_desk"]),
});

/**
 * Adds a staff member. When Supabase Auth is configured the auth user is
 * created too (with the demo password), so they can sign in straight away.
 */
export async function createStaff(db: Db, input: z.infer<typeof staffSchema>): Promise<{ id: string; authCreated: boolean }> {
  const email = input.email.toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let id: string | null = null;
  let authCreated = false;
  if (url && key) {
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase.auth.admin.createUser({ email, password: process.env.DEMO_PASSWORD ?? "Blackthorn2026!", email_confirm: true, user_metadata: { name: input.name } });
    if (error) {
      if (!/already/i.test(error.message)) throw new Error(`Could not create the sign in: ${error.message}`);
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      id = list?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    } else {
      id = data.user.id;
      authCreated = true;
    }
  }
  const [row] = await db<{ id: string }[]>`
    insert into public.staff_users (id, name, email, role) values (${id ?? db`gen_random_uuid()`}, ${input.name}, ${email}, ${input.role}::staff_role) returning id`;
  return { id: row!.id, authCreated };
}

export async function updateStaff(db: Db, id: string, input: { name?: string; role?: StaffRole; active?: boolean }) {
  await db`update public.staff_users set
    name = coalesce(${input.name ?? null}, name),
    role = coalesce(${input.role ?? null}::staff_role, role),
    active = coalesce(${input.active ?? null}, active)
    where id = ${id}`;
}

// ---------------------------------------------------------------------------
// Saved replies
// ---------------------------------------------------------------------------
export const savedReplySchema = z.object({
  title: z.string().trim().min(2, "Give it a title").max(80),
  category: z.string().trim().max(40).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Write the reply").max(5000),
});

export async function createSavedReply(db: Db, input: z.infer<typeof savedReplySchema>): Promise<string> {
  const [row] = await db<{ id: string }[]>`insert into public.saved_replies (title, category, body, sort_order) values (${input.title}, ${input.category || null}, ${input.body}, (select coalesce(max(sort_order), 0) + 10 from public.saved_replies)) returning id`;
  return row!.id;
}
export async function updateSavedReply(db: Db, id: string, input: z.infer<typeof savedReplySchema>) {
  await db`update public.saved_replies set title = ${input.title}, category = ${input.category || null}, body = ${input.body} where id = ${id}`;
}
export async function deleteSavedReply(db: Db, id: string) {
  await db`delete from public.saved_replies where id = ${id}`;
}

// ---------------------------------------------------------------------------
// Categories, root causes, SLA
// ---------------------------------------------------------------------------
export const categorySchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  label: z.string().trim().min(2).max(40),
  default_priority: z.enum(["low", "normal", "high", "urgent"]),
});

export async function upsertCategory(db: Db, input: z.infer<typeof categorySchema>) {
  await db`insert into public.ticket_categories (key, label, default_priority, sort_order) values (${input.key}, ${input.label}, ${input.default_priority}::ticket_priority, (select coalesce(max(sort_order), 0) + 10 from public.ticket_categories))
    on conflict (key) do update set label = excluded.label, default_priority = excluded.default_priority`;
}
export async function setCategoryActive(db: Db, key: string, active: boolean) {
  if (key === "complaint" && !active) throw new Error("The complaint category is used by the complaint handling rules and cannot be disabled.");
  await db`update public.ticket_categories set active = ${active} where key = ${key}`;
}

export const rootCauseSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  label: z.string().trim().min(2).max(40),
});
export async function upsertRootCause(db: Db, input: z.infer<typeof rootCauseSchema>) {
  await db`insert into public.root_cause_tags (key, label) values (${input.key}, ${input.label}) on conflict (key) do update set label = excluded.label`;
}
export async function setRootCauseActive(db: Db, key: string, active: boolean) {
  await db`update public.root_cause_tags set active = ${active} where key = ${key}`;
}

export const slaSchema = z.object({
  urgent: z.coerce.number().int().min(1).max(720),
  high: z.coerce.number().int().min(1).max(720),
  normal: z.coerce.number().int().min(1).max(720),
  low: z.coerce.number().int().min(1).max(720),
});
export async function updateSla(db: Db, input: z.infer<typeof slaSchema>) {
  for (const [priority, hours] of Object.entries(input)) {
    await db`insert into public.sla_policies (priority, hours) values (${priority}::ticket_priority, ${hours}) on conflict (priority) do update set hours = excluded.hours`;
  }
}
