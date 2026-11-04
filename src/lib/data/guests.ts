import { z } from "zod";
import type { Db } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Listing with server side search, filter, sort and pagination
// ---------------------------------------------------------------------------

export const guestListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  sort: z.enum(["name", "last_visit", "spend", "visits", "created"]).optional().default("last_visit"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  per: z.coerce.number().int().min(10).max(100).optional().default(25),
  email_consent: z.enum(["any", "yes", "no"]).optional().default("any"),
  sms_consent: z.enum(["any", "yes", "no"]).optional().default("any"),
  flag: z.enum(["any", "accessibility", "do_not_touch", "banned"]).optional().default("any"),
  tag: z.string().trim().max(50).optional().default(""),
  season: z.coerce.number().int().optional(),
  min_visits: z.coerce.number().int().min(0).optional(),
});
export type GuestListParams = z.infer<typeof guestListParamsSchema>;

export interface GuestListRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  email_consent: boolean;
  sms_consent: boolean;
  tags: string[];
  accessibility_needs: string | null;
  do_not_touch: boolean;
  banned: boolean;
  lifetime_spend_pence: number;
  visit_count: number;
  last_visit_on: string | null;
  created_at: Date;
}

const SORT_SQL: Record<GuestListParams["sort"], string> = {
  name: "lower(g.last_name), lower(g.first_name)",
  last_visit: "g.last_visit_on",
  spend: "g.lifetime_spend_pence",
  visits: "g.visit_count",
  created: "g.created_at",
};

function buildWhere(db: Db, p: GuestListParams) {
  const conds = [];
  if (p.q) {
    const q = p.q;
    const like = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
    const compact = q.replace(/\s+/g, "").toUpperCase();
    conds.push(db`(
      (g.first_name || ' ' || g.last_name) ilike ${like}
      or g.email ilike ${like}
      or replace(coalesce(g.phone, ''), ' ', '') like ${"%" + compact + "%"}
      or upper(replace(coalesce(g.postcode, ''), ' ', '')) like ${compact + "%"}
      or exists (select 1 from crm.bookings b where b.guest_id = g.id and upper(b.reference) = ${compact.startsWith("BTH-") ? compact : "BTH-" + compact})
    )`);
  }
  if (p.email_consent !== "any") conds.push(db`g.email_consent = ${p.email_consent === "yes"}`);
  if (p.sms_consent !== "any") conds.push(db`g.sms_consent = ${p.sms_consent === "yes"}`);
  if (p.flag === "accessibility") conds.push(db`g.accessibility_needs is not null`);
  if (p.flag === "do_not_touch") conds.push(db`g.do_not_touch`);
  if (p.flag === "banned") conds.push(db`g.banned`);
  if (p.tag) conds.push(db`${p.tag} = any (g.tags)`);
  if (p.season) {
    conds.push(db`exists (
      select 1 from crm.bookings b join crm.event_nights n on n.id = b.event_night_id join crm.seasons s on s.id = n.season_id
      where b.guest_id = g.id and s.year = ${p.season} and b.status <> 'refunded')`);
  }
  if (p.min_visits !== undefined) conds.push(db`g.visit_count >= ${p.min_visits}`);
  if (conds.length === 0) return db`true`;
  return conds.reduce((acc, c) => db`${acc} and ${c}`);
}

export async function listGuests(db: Db, p: GuestListParams): Promise<{ rows: GuestListRow[]; total: number }> {
  const where = buildWhere(db, p);
  const offset = (p.page - 1) * p.per;
  const dir = p.dir === "asc" ? db`asc nulls first` : db`desc nulls last`;
  const [rows, [{ count }]] = await Promise.all([
    db<GuestListRow[]>`
      select g.id, g.first_name, g.last_name, g.email, g.phone, g.postcode, g.email_consent, g.sms_consent, g.tags,
        g.accessibility_needs, g.do_not_touch, g.banned, g.lifetime_spend_pence, g.visit_count, g.last_visit_on::text, g.created_at
      from crm.guests g
      where ${where}
      order by ${db.unsafe(SORT_SQL[p.sort])} ${dir}, g.id
      limit ${p.per} offset ${offset}`,
    db<{ count: number }[]>`select count(*)::int as count from crm.guests g where ${where}`,
  ]);
  return { rows, total: count };
}

/** Streams every matching guest (no pagination) for CSV export. */
export async function listGuestsForExport(db: Db, p: GuestListParams): Promise<GuestListRow[]> {
  const where = buildWhere(db, p);
  return db<GuestListRow[]>`
    select g.id, g.first_name, g.last_name, g.email, g.phone, g.postcode, g.email_consent, g.sms_consent, g.tags,
      g.accessibility_needs, g.do_not_touch, g.banned, g.lifetime_spend_pence, g.visit_count, g.last_visit_on::text, g.created_at
    from crm.guests g where ${where}
    order by ${db.unsafe(SORT_SQL[p.sort])} ${p.dir === "asc" ? db`asc nulls first` : db`desc nulls last`}, g.id
    limit 20000`;
}

export async function listTags(db: Db): Promise<string[]> {
  const rows = await db<{ tag: string }[]>`select distinct unnest(tags) as tag from crm.guests order by 1`;
  return rows.map((r) => r.tag);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  postcode: string | null;
  date_of_birth: string | null;
  email_consent: boolean;
  email_consent_at: Date | null;
  email_consent_source: string | null;
  sms_consent: boolean;
  sms_consent_at: Date | null;
  sms_consent_source: string | null;
  tags: string[];
  accessibility_needs: string | null;
  do_not_touch: boolean;
  banned: boolean;
  banned_reason: string | null;
  notes: string | null;
  lifetime_spend_pence: number;
  visit_count: number;
  first_visit_on: string | null;
  last_visit_on: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function getGuest(db: Db, id: string): Promise<Guest | null> {
  const rows = await db<Guest[]>`
    select id, first_name, last_name, email, phone, postcode, date_of_birth::text, email_consent, email_consent_at, email_consent_source::text,
      sms_consent, sms_consent_at, sms_consent_source::text, tags, accessibility_needs, do_not_touch, banned, banned_reason, notes,
      lifetime_spend_pence, visit_count, first_visit_on::text, last_visit_on::text, created_at, updated_at
    from crm.guests where id = ${id}`;
  return rows[0] ?? null;
}

export interface GuestStats {
  total_bookings: number;
  open_tickets: number;
  resolved_tickets: number;
  surveys_completed: number;
  avg_survey_score: number | null;
  messages_sent: number;
  last_booking_at: Date | null;
}

export async function getGuestStats(db: Db, guestId: string): Promise<GuestStats> {
  const [counts] = await db<GuestStats[]>`
    select
      (select count(*) from crm.bookings where guest_id = ${guestId})::int as total_bookings,
      (select count(*) from crm.tickets where guest_id = ${guestId} and status <> 'resolved')::int as open_tickets,
      (select count(*) from crm.tickets where guest_id = ${guestId} and status = 'resolved')::int as resolved_tickets,
      (select count(*) from crm.surveys where guest_id = ${guestId})::int as surveys_completed,
      (select round(avg(overall_score)::numeric, 1) from crm.surveys where guest_id = ${guestId})::float as avg_survey_score,
      (select count(*) from crm.messages_outbox where guest_id = ${guestId})::int as messages_sent,
      (select max(booked_at) from crm.bookings where guest_id = ${guestId}) as last_booking_at`;
  return counts!;
}

export interface GuestBooking {
  id: string;
  reference: string;
  date: string;
  entry_time: string;
  ticket_type: string;
  group_size: number;
  addons: string[];
  total_paid_pence: number;
  refunded_pence: number;
  status: string;
  booked_at: Date;
  season_year: number;
  survey_score: number | null;
}

export async function getGuestBookings(db: Db, guestId: string): Promise<GuestBooking[]> {
  return db<GuestBooking[]>`
    select b.id, b.reference, n.date::text as date, b.entry_time::text, b.ticket_type::text, b.group_size, b.addons,
      b.total_paid_pence, b.refunded_pence, b.status::text, b.booked_at, s.year as season_year,
      (select overall_score from crm.surveys sv where sv.booking_id = b.id limit 1) as survey_score
    from crm.bookings b
    join crm.event_nights n on n.id = b.event_night_id
    join crm.seasons s on s.id = n.season_id
    where b.guest_id = ${guestId}
    order by n.date desc, b.booked_at desc`;
}

export interface TimelineEvent {
  kind: "booking" | "survey" | "message" | "ticket" | "note" | "activity";
  id: string;
  at: Date;
  title: string;
  detail: string | null;
  href: string | null;
  meta: Record<string, unknown>;
}

/** Everything that happened to a guest, newest first. One query via UNION ALL. */
export async function getGuestTimeline(db: Db, guestId: string, limit = 200): Promise<TimelineEvent[]> {
  return db<TimelineEvent[]>`
    select * from (
      select 'booking' as kind, b.id::text as id, b.booked_at as at,
        'Booked ' || b.group_size || ' x ' || initcap(replace(b.ticket_type::text, '_', ' ')) || ' for ' || to_char(n.date, 'DD/MM/YYYY') as title,
        'Ref ' || b.reference || ' · £' || to_char(b.total_paid_pence / 100.0, 'FM999990.00') || ' · ' || b.status as detail,
        null::text as href,
        jsonb_build_object('reference', b.reference, 'status', b.status) as meta
      from crm.bookings b join crm.event_nights n on n.id = b.event_night_id where b.guest_id = ${guestId}
      union all
      select 'survey', s.id::text, s.submitted_at, 'Survey: ' || s.overall_score || '/10', s.comments, null,
        jsonb_build_object('score', s.overall_score, 'maze_scores', s.maze_scores)
      from crm.surveys s where s.guest_id = ${guestId}
      union all
      select 'message', o.id::text, o.sent_at,
        case o.channel when 'sms' then 'SMS sent' else 'Email sent: ' || coalesce(o.subject, '') end,
        left(o.body_text, 140), '/outbox/' || o.id,
        jsonb_build_object('channel', o.channel, 'opened', o.opened_at is not null, 'clicked', o.clicked_at is not null, 'campaign_id', o.campaign_id, 'automation_id', o.automation_id, 'ticket_id', o.ticket_id)
      from crm.messages_outbox o where o.guest_id = ${guestId}
      union all
      select 'ticket', t.id::text, t.created_at, 'Ticket #' || t.number || ': ' || t.subject,
        initcap(replace(t.category, '_', ' ')) || ' · ' || replace(t.status::text, '_', ' '), '/support/' || t.id,
        jsonb_build_object('status', t.status, 'category', t.category, 'priority', t.priority)
      from crm.tickets t where t.guest_id = ${guestId}
      union all
      select 'activity', a.id::text, a.created_at, a.summary, 'by ' || coalesce(a.staff_name, 'system'), null,
        jsonb_build_object('action', a.action) || a.details
      from crm.activity_log a where a.entity_type = 'guest' and a.entity_id = ${guestId}
    ) t
    order by at desc
    limit ${limit}`;
}

export interface GuestTicket {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: Date;
  sla_due_at: Date;
}

export async function getGuestTickets(db: Db, guestId: string): Promise<GuestTicket[]> {
  return db<GuestTicket[]>`
    select id, number, subject, category, priority::text, status::text, created_at, sla_due_at
    from crm.tickets where guest_id = ${guestId} order by created_at desc`;
}

export interface GuestMessage {
  id: string;
  channel: string;
  subject: string | null;
  body_text: string;
  sent_at: Date;
  opened_at: Date | null;
  clicked_at: Date | null;
  campaign_name: string | null;
  automation_name: string | null;
  ticket_number: number | null;
  status: string;
}

export async function getGuestMessages(db: Db, guestId: string): Promise<GuestMessage[]> {
  return db<GuestMessage[]>`
    select o.id, o.channel::text, o.subject, o.body_text, o.sent_at, o.opened_at, o.clicked_at, o.status::text,
      c.name as campaign_name, a.name as automation_name, t.number as ticket_number
    from crm.messages_outbox o
    left join crm.campaigns c on c.id = o.campaign_id
    left join crm.automations a on a.id = o.automation_id
    left join crm.tickets t on t.id = o.ticket_id
    where o.guest_id = ${guestId} order by o.sent_at desc limit 200`;
}

// ---------------------------------------------------------------------------
// Mutations (called from server actions after Zod validation)
// ---------------------------------------------------------------------------

export const guestDetailsSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email address").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^(\+44\s?|0)\d[\d\s]{8,12}$|^$/, "Enter a UK phone number")
    .optional()
    .or(z.literal("")),
  postcode: z
    .string()
    .trim()
    .toUpperCase()
    .max(10)
    .regex(/^([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})?$/, "Enter a valid UK postcode")
    .optional()
    .or(z.literal("")),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/, "Enter a date").optional().or(z.literal("")),
  accessibility_needs: z.string().trim().max(500).optional().or(z.literal("")),
  do_not_touch: z.boolean().optional().default(false),
  banned: z.boolean().optional().default(false),
  banned_reason: z.string().trim().max(500).optional().or(z.literal("")),
});
export type GuestDetailsInput = z.infer<typeof guestDetailsSchema>;

export async function updateGuestDetails(db: Db, id: string, input: GuestDetailsInput): Promise<Guest> {
  const rows = await db<Guest[]>`
    update crm.guests set
      first_name = ${input.first_name}, last_name = ${input.last_name}, email = ${input.email.toLowerCase()},
      phone = ${input.phone || null}, postcode = ${input.postcode || null}, date_of_birth = ${input.date_of_birth || null},
      accessibility_needs = ${input.accessibility_needs || null}, do_not_touch = ${input.do_not_touch},
      banned = ${input.banned}, banned_reason = ${input.banned ? input.banned_reason || null : null}
    where id = ${id}
    returning *`;
  if (!rows[0]) throw new Error("Guest not found or you do not have permission to edit guests");
  return rows[0];
}

export const consentSchema = z.object({
  channel: z.enum(["email", "sms"]),
  value: z.boolean(),
  source: z.enum(["staff", "web_form", "booking", "unsubscribe_link"]).default("staff"),
});

export async function updateConsent(db: Db, id: string, input: z.infer<typeof consentSchema>) {
  if (input.channel === "email") {
    await db`update crm.guests set email_consent = ${input.value}, email_consent_at = now(), email_consent_source = ${input.source} where id = ${id}`;
  } else {
    await db`update crm.guests set sms_consent = ${input.value}, sms_consent_at = now(), sms_consent_source = ${input.source} where id = ${id}`;
  }
}

export const tagsSchema = z.array(z.string().trim().min(1).max(30).regex(/^[a-z0-9_\-]+$/i, "Tags can only contain letters, numbers, _ and -")).max(20);

export async function updateTags(db: Db, id: string, tags: string[]) {
  const clean = [...new Set(tags.map((t) => t.toLowerCase()))];
  await db`update crm.guests set tags = ${clean} where id = ${id}`;
  return clean;
}

export const noteSchema = z.object({ note: z.string().trim().min(1, "Write a note first").max(2000) });

export async function appendNote(db: Db, id: string, note: string, staffName: string) {
  const stamp = new Date();
  const line = `[${stamp.toLocaleDateString("en-GB", { timeZone: "Europe/London" })} ${stamp.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })} · ${staffName}] ${note}`;
  await db`update crm.guests set notes = case when notes is null or notes = '' then ${line} else ${line} || E'\n\n' || notes end where id = ${id}`;
}
