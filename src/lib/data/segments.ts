import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { compileSegment } from "@/lib/segments/compile";
import { exclusionReasonSql, type AudienceSummary, type Channel, type ExclusionReason } from "@/lib/segments/consent";
import { ruleGroupSchema, type RuleGroup } from "@/lib/segments/types";

export interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  rules: RuleGroup;
  created_by: string | null;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  campaign_count: number;
}

export async function listSegments(db: Db): Promise<SegmentRow[]> {
  return db<SegmentRow[]>`
    select s.id, s.name, s.description, s.rules, s.created_by, st.name as created_by_name, s.created_at, s.updated_at,
      (select count(*) from crm.campaigns c where c.segment_id = s.id)::int as campaign_count
    from crm.segments s left join crm.staff_users st on st.id = s.created_by
    order by s.updated_at desc`;
}

export async function getSegment(db: Db, id: string): Promise<SegmentRow | null> {
  const rows = await db<SegmentRow[]>`
    select s.id, s.name, s.description, s.rules, s.created_by, st.name as created_by_name, s.created_at, s.updated_at,
      (select count(*) from crm.campaigns c where c.segment_id = s.id)::int as campaign_count
    from crm.segments s left join crm.staff_users st on st.id = s.created_by where s.id = ${id}`;
  return rows[0] ?? null;
}

export const segmentInputSchema = z.object({
  name: z.string().trim().min(2, "Give the segment a name").max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  rules: ruleGroupSchema,
});
export type SegmentInput = z.infer<typeof segmentInputSchema>;

export async function createSegment(db: Db, input: SegmentInput, staffId: string): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into crm.segments (name, description, rules, created_by)
    values (${input.name}, ${input.description || null}, ${db.json(input.rules as never)}, ${staffId}) returning id`;
  return row!.id;
}

export async function updateSegment(db: Db, id: string, input: SegmentInput): Promise<void> {
  const rows = await db`update crm.segments set name = ${input.name}, description = ${input.description || null}, rules = ${db.json(input.rules as never)} where id = ${id} returning id`;
  if (rows.length === 0) throw new Error("Segment not found");
}

export async function deleteSegment(db: Db, id: string): Promise<void> {
  await db`delete from crm.segments where id = ${id}`;
}

export async function countSegment(db: Db, rules: unknown): Promise<number> {
  const { where, params } = compileSegment(rules);
  const rows = await db.unsafe<{ count: number }[]>(`select count(*)::int as count from crm.guests g where ${where}`, params as never[]);
  return rows[0]?.count ?? 0;
}

export interface PreviewGuest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  postcode: string | null;
  email_consent: boolean;
  sms_consent: boolean;
  visit_count: number;
  lifetime_spend_pence: number;
  banned: boolean;
}

export async function previewSegment(db: Db, rules: unknown, limit = 20): Promise<PreviewGuest[]> {
  const { where, params } = compileSegment(rules);
  return db.unsafe<PreviewGuest[]>(
    `select g.id, g.first_name, g.last_name, g.email, g.postcode, g.email_consent, g.sms_consent, g.visit_count, g.lifetime_spend_pence, g.banned
     from crm.guests g where ${where} order by g.last_visit_on desc nulls last, g.last_name limit ${Math.min(100, Math.max(1, limit))}`,
    params as never[],
  );
}

/** How many guests in the segment can actually be sent to on a channel, and why the rest can't. */
export async function audienceSummary(db: Db, rules: unknown, channel: Channel): Promise<AudienceSummary> {
  const { where, params } = compileSegment(rules);
  const rows = await db.unsafe<{ reason: ExclusionReason | null; count: number }[]>(
    `select ${exclusionReasonSql(channel)} as reason, count(*)::int as count from crm.guests g where ${where} group by 1`,
    params as never[],
  );
  const reasons: Partial<Record<ExclusionReason, number>> = {};
  let eligible = 0;
  let total = 0;
  for (const r of rows) {
    total += r.count;
    if (r.reason) reasons[r.reason] = r.count;
    else eligible = r.count;
  }
  return { total, eligible, excluded: total - eligible, reasons };
}

export interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
}

/** Guests in the segment who may receive a message on the channel. */
export async function eligibleRecipients(db: Db, rules: unknown, channel: Channel): Promise<Recipient[]> {
  const { where, params } = compileSegment(rules);
  return db.unsafe<Recipient[]>(
    `select g.id, g.first_name, g.last_name, g.email, g.phone from crm.guests g
     where (${where}) and (${exclusionReasonSql(channel)}) is null order by g.last_name, g.first_name`,
    params as never[],
  );
}
