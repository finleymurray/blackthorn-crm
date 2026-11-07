import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { emailBlocksSchema, renderBlocksToHtml, renderBlocksToText, type EmailBlock } from "@/lib/messaging/email-blocks";
import { renderMergeFields, type MergeValues } from "@/lib/messaging/merge";
import { sendBulk, sendEmail, sendSms, type OutgoingEmail, type OutgoingSms } from "@/lib/messaging/provider";
import { audienceSummary, eligibleRecipients } from "./segments";
import { brandingFrom, getParkSettings } from "./settings";
import type { AudienceSummary } from "@/lib/segments/consent";

export interface CampaignRow {
  id: string;
  name: string;
  channel: "email" | "sms";
  segment_id: string | null;
  segment_name: string | null;
  segment_rules: unknown;
  subject: string | null;
  preheader: string | null;
  blocks: EmailBlock[];
  sms_body: string | null;
  status: "draft" | "scheduled" | "sent";
  scheduled_for: Date | null;
  sent_at: Date | null;
  stats: CampaignStats;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignStats {
  audience?: number;
  recipients?: number;
  excluded?: number;
  excluded_reasons?: Record<string, number>;
  opens?: number;
  clicks?: number;
  bookings_after?: number;
  revenue_after_pence?: number;
}

const select = (db: Db) => db`
  select c.id, c.name, c.channel::text as channel, c.segment_id, s.name as segment_name, s.rules as segment_rules, c.subject, c.preheader, c.blocks, c.sms_body,
    c.status::text as status, c.scheduled_for, c.sent_at, c.stats, st.name as created_by_name, c.created_at, c.updated_at
  from crm.campaigns c
  left join crm.segments s on s.id = c.segment_id
  left join crm.staff_users st on st.id = c.created_by`;

export async function listCampaigns(db: Db): Promise<CampaignRow[]> {
  return db<CampaignRow[]>`${select(db)} order by coalesce(c.sent_at, c.scheduled_for, c.updated_at) desc`;
}

export async function getCampaign(db: Db, id: string): Promise<CampaignRow | null> {
  const rows = await db<CampaignRow[]>`${select(db)} where c.id = ${id}`;
  return rows[0] ?? null;
}

export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(2, "Give the campaign a name").max(100),
    channel: z.enum(["email", "sms"]),
    segment_id: z.string().uuid("Choose a segment").nullable(),
    subject: z.string().trim().max(150).optional().or(z.literal("")),
    preheader: z.string().trim().max(150).optional().or(z.literal("")),
    blocks: emailBlocksSchema.default([]),
    sms_body: z.string().trim().max(640).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.channel === "email" && !v.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "Email campaigns need a subject line" });
    if (v.channel === "sms" && !v.sms_body) ctx.addIssue({ code: "custom", path: ["sms_body"], message: "Write the text message" });
  });
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export async function createCampaign(db: Db, input: CampaignInput, staffId: string): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    insert into crm.campaigns (name, channel, segment_id, subject, preheader, blocks, sms_body, created_by)
    values (${input.name}, ${input.channel}, ${input.segment_id}, ${input.subject || null}, ${input.preheader || null}, ${db.json(input.blocks as never)}, ${input.sms_body || null}, ${staffId})
    returning id`;
  return row!.id;
}

export async function updateCampaign(db: Db, id: string, input: CampaignInput): Promise<void> {
  const rows = await db`
    update crm.campaigns set name = ${input.name}, channel = ${input.channel}, segment_id = ${input.segment_id}, subject = ${input.subject || null},
      preheader = ${input.preheader || null}, blocks = ${db.json(input.blocks as never)}, sms_body = ${input.sms_body || null}
    where id = ${id} and status <> 'sent' returning id`;
  if (rows.length === 0) throw new Error("Campaign not found or already sent");
}

export async function deleteCampaign(db: Db, id: string): Promise<void> {
  const rows = await db`delete from crm.campaigns where id = ${id} and status <> 'sent' returning id`;
  if (rows.length === 0) throw new Error("Sent campaigns cannot be deleted");
}

export async function duplicateCampaign(db: Db, id: string, staffId: string): Promise<string> {
  const c = await getCampaign(db, id);
  if (!c) throw new Error("Campaign not found");
  return createCampaign(
    db,
    { name: `${c.name} (copy)`, channel: c.channel, segment_id: c.segment_id, subject: c.subject ?? "", preheader: c.preheader ?? "", blocks: c.blocks, sms_body: c.sms_body ?? "" },
    staffId,
  );
}

/** Sample merge values for previews and test sends. */
export const SAMPLE_VALUES: MergeValues = {
  first_name: "Chloe",
  last_name: "Bennett",
  full_name: "Chloe Bennett",
  email: "chloe.bennett@example.com",
  booking_reference: "BTH-7K2Q",
  visit_date: "31/10/2026",
  entry_time: "19:30",
  ticket_type: "Fast Track",
  group_size: 4,
  park_name: "Blackthorn Scream Park",
  support_email: "support@blackthornscreampark.co.uk",
};

async function guestValues(db: Db, guestId: string, parkName: string, supportEmail: string): Promise<MergeValues> {
  const [g] = await db<{ first_name: string; last_name: string; email: string }[]>`select first_name, last_name, email from crm.guests where id = ${guestId}`;
  const [b] = await db<{ reference: string; date: string; entry_time: string; ticket_type: string; group_size: number }[]>`
    select b.reference, n.date::text, b.entry_time::text, b.ticket_type::text, b.group_size from crm.bookings b join crm.event_nights n on n.id = b.event_night_id
    where b.guest_id = ${guestId} and b.status <> 'refunded' order by n.date desc limit 1`;
  return {
    first_name: g?.first_name,
    last_name: g?.last_name,
    full_name: g ? `${g.first_name} ${g.last_name}` : "",
    email: g?.email,
    booking_reference: b?.reference,
    visit_date: b ? b.date.split("-").reverse().join("/") : "",
    entry_time: b?.entry_time?.slice(0, 5),
    ticket_type: b?.ticket_type?.replace("_", " "),
    group_size: b?.group_size,
    park_name: parkName,
    support_email: supportEmail,
  };
}

export async function campaignAudience(db: Db, c: CampaignRow): Promise<AudienceSummary | null> {
  if (!c.segment_rules) return null;
  return audienceSummary(db, c.segment_rules, c.channel);
}

/** Writes a single test message to the outbox for the staff member. */
export async function sendTest(db: Db, c: CampaignRow, to: string, staffName: string): Promise<string> {
  const settings = await getParkSettings(db);
  const values = { ...SAMPLE_VALUES, first_name: staffName.split(" ")[0] ?? "there", full_name: staffName, email: to, park_name: settings.name, support_email: settings.support_email };
  if (c.channel === "email") {
    const { id } = await sendEmail(db, {
      guestId: null,
      to,
      toName: staffName,
      subject: `[TEST] ${renderMergeFields(c.subject ?? "", values)}`,
      html: renderBlocksToHtml(c.blocks, values, brandingFrom(settings)),
      text: renderBlocksToText(c.blocks, values),
      campaignId: c.id,
      status: "test",
    });
    return id;
  }
  const { id } = await sendSms(db, { guestId: null, to, toName: staffName, text: renderMergeFields(c.sms_body ?? "", values), campaignId: c.id, status: "test" });
  return id;
}

/**
 * Sends the campaign now: one outbox row per eligible recipient. Consent is
 * re-checked here, not just in the UI. Engagement is simulated afterwards so
 * the report has something to show.
 */
export async function sendCampaignNow(db: Db, c: CampaignRow): Promise<CampaignStats> {
  if (c.status === "sent") throw new Error("This campaign has already been sent");
  if (!c.segment_id || !c.segment_rules) throw new Error("Choose a segment before sending");
  const settings = await getParkSettings(db);
  const branding = brandingFrom(settings);
  const [audience, recipients] = await Promise.all([audienceSummary(db, c.segment_rules, c.channel), eligibleRecipients(db, c.segment_rules, c.channel)]);

  const rows: Array<OutgoingEmail | OutgoingSms> = [];
  for (const r of recipients) {
    const values = await guestValues(db, r.id, settings.name, settings.support_email);
    if (c.channel === "email") {
      rows.push({
        guestId: r.id,
        to: r.email,
        toName: `${r.first_name} ${r.last_name}`,
        subject: renderMergeFields(c.subject ?? "", values),
        html: renderBlocksToHtml(c.blocks, values, branding),
        text: renderBlocksToText(c.blocks, values),
        campaignId: c.id,
      });
    } else {
      rows.push({ guestId: r.id, to: r.phone!, toName: `${r.first_name} ${r.last_name}`, text: renderMergeFields(c.sms_body ?? "", values), campaignId: c.id });
    }
  }
  const sent = await sendBulk(db, rows, c.channel);

  // Simulated engagement: realistic open and click rates, spread over the next two days.
  const openRate = c.channel === "email" ? 0.42 : 0.94;
  const clickRate = c.channel === "email" ? 0.18 : 0.11;
  await db.unsafe(
    `with picked as (
       select id, random() as r from crm.messages_outbox where campaign_id = $1 and status = 'sent'
     )
     , opened as (
       select id, r, case when r < $2 then now() + (random() * interval '36 hours') else null end as opened_at from picked
     )
     update crm.messages_outbox o set
       opened_at = p.opened_at,
       clicked_at = case when p.r < $2 * $3 then p.opened_at + (random() * interval '4 hours') else null end
     from opened p where p.id = o.id`,
    [c.id, openRate, clickRate],
  );
  const [eng] = await db<{ opens: number; clicks: number }[]>`
    select count(opened_at)::int as opens, count(clicked_at)::int as clicks from crm.messages_outbox where campaign_id = ${c.id} and status = 'sent'`;

  const stats: CampaignStats = {
    audience: audience.total,
    recipients: sent,
    excluded: audience.excluded,
    excluded_reasons: audience.reasons,
    opens: eng?.opens ?? 0,
    clicks: eng?.clicks ?? 0,
    bookings_after: 0,
    revenue_after_pence: 0,
  };
  await db`update crm.campaigns set status = 'sent', sent_at = now(), scheduled_for = null, stats = ${db.json(stats as never)} where id = ${c.id}`;
  return stats;
}

export async function scheduleCampaign(db: Db, c: CampaignRow, when: Date): Promise<void> {
  if (c.status === "sent") throw new Error("This campaign has already been sent");
  if (!c.segment_id) throw new Error("Choose a segment before scheduling");
  await db`update crm.campaigns set status = 'scheduled', scheduled_for = ${when} where id = ${c.id}`;
}

export async function unscheduleCampaign(db: Db, id: string): Promise<void> {
  await db`update crm.campaigns set status = 'draft', scheduled_for = null where id = ${id} and status = 'scheduled'`;
}

export interface CampaignReport {
  stats: CampaignStats;
  recipients: number;
  opens: number;
  clicks: number;
  bookings_after: number;
  revenue_after_pence: number;
  timeline: Array<{ hour: string; opens: number; clicks: number }>;
  sample: Array<{ id: string; recipient_name: string | null; recipient: string; opened_at: Date | null; clicked_at: Date | null; guest_id: string | null }>;
}

/** Report figures are computed from the outbox and bookings so they stay honest if data changes. */
export async function getCampaignReport(db: Db, c: CampaignRow): Promise<CampaignReport> {
  const [counts] = await db<{ recipients: number; opens: number; clicks: number }[]>`
    select count(*)::int as recipients, count(opened_at)::int as opens, count(clicked_at)::int as clicks
    from crm.messages_outbox where campaign_id = ${c.id} and status = 'sent'`;
  const [after] = await db<{ bookings_after: number; revenue_after_pence: number }[]>`
    select count(*)::int as bookings_after, coalesce(sum(b.total_paid_pence), 0)::int as revenue_after_pence
    from crm.bookings b
    where b.source_campaign_id = ${c.id}
       or (b.booked_at > ${c.sent_at ?? new Date()}::timestamptz and b.booked_at < ${c.sent_at ?? new Date()}::timestamptz + interval '14 days'
           and b.guest_id in (select guest_id from crm.messages_outbox where campaign_id = ${c.id} and status = 'sent'))`;
  const timeline = await db<{ hour: string; opens: number; clicks: number }[]>`
    with hours as (
      select generate_series(date_trunc('hour', ${c.sent_at ?? new Date()}::timestamptz), date_trunc('hour', ${c.sent_at ?? new Date()}::timestamptz) + interval '47 hours', interval '1 hour') as h
    )
    select to_char(h.h at time zone 'Europe/London', 'DD/MM HH24:00') as hour,
      (select count(*) from crm.messages_outbox o where o.campaign_id = ${c.id} and o.opened_at >= h.h and o.opened_at < h.h + interval '1 hour')::int as opens,
      (select count(*) from crm.messages_outbox o where o.campaign_id = ${c.id} and o.clicked_at >= h.h and o.clicked_at < h.h + interval '1 hour')::int as clicks
    from hours h order by h.h`;
  const sample = await db<CampaignReport["sample"]>`
    select id, recipient_name, recipient, opened_at, clicked_at, guest_id from crm.messages_outbox
    where campaign_id = ${c.id} and status = 'sent' order by clicked_at desc nulls last, opened_at desc nulls last, sent_at limit 25`;
  return { stats: c.stats, ...counts!, ...after!, timeline, sample };
}
