import { z } from "zod";
import type { Db } from "@/lib/db/client";
import type { StaffUser } from "@/lib/auth/types";
import { logActivity } from "./activity";
import { formatDateOnly, formatMoney } from "@/lib/format";

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export const bookingListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", "confirmed", "refunded", "transferred", "no_show"]).optional().default("all"),
  ticket_type: z.enum(["", "standard", "fast_track", "vip", "group"]).optional().default(""),
  night: z.string().uuid().optional().or(z.literal("")).default(""),
  season: z.coerce.number().int().optional(),
  when: z.enum(["all", "upcoming", "past"]).optional().default("all"),
  sort: z.enum(["night", "booked", "paid", "guest"]).optional().default("night"),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  per: z.coerce.number().int().min(10).max(100).optional().default(30),
});
export type BookingListParams = z.infer<typeof bookingListParamsSchema>;

export interface BookingListRow {
  id: string;
  reference: string;
  guest_id: string;
  guest_name: string;
  guest_email: string;
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
}

const SORT: Record<BookingListParams["sort"], string> = {
  night: "n.date",
  booked: "b.booked_at",
  paid: "b.total_paid_pence",
  guest: "lower(g.last_name), lower(g.first_name)",
};

function where(db: Db, p: BookingListParams) {
  const conds = [];
  if (p.q) {
    const like = `%${p.q.replace(/[%_]/g, (m) => "\\" + m)}%`;
    const compact = p.q.replace(/\s+/g, "").toUpperCase();
    const ref = compact.startsWith("BTH-") ? compact : compact.startsWith("BTH") ? "BTH-" + compact.slice(3) : "BTH-" + compact;
    conds.push(db`(upper(b.reference) like ${ref + "%"} or (g.first_name || ' ' || g.last_name) ilike ${like} or g.email ilike ${like})`);
  }
  if (p.status !== "all") conds.push(db`b.status = ${p.status}::booking_status`);
  if (p.ticket_type) conds.push(db`b.ticket_type = ${p.ticket_type}::ticket_type`);
  if (p.night) conds.push(db`b.event_night_id = ${p.night}`);
  if (p.season) conds.push(db`s.year = ${p.season}`);
  if (p.when === "upcoming") conds.push(db`n.date >= current_date`);
  if (p.when === "past") conds.push(db`n.date < current_date`);
  return conds.length ? conds.reduce((a, c) => db`${a} and ${c}`) : db`true`;
}

export async function listBookings(db: Db, p: BookingListParams): Promise<{ rows: BookingListRow[]; total: number; revenue_pence: number }> {
  const w = where(db, p);
  const dir = p.dir === "asc" ? db`asc` : db`desc`;
  const [rows, [agg]] = await Promise.all([
    db<BookingListRow[]>`
      select b.id, b.reference, b.guest_id, g.first_name || ' ' || g.last_name as guest_name, g.email as guest_email, n.date::text as date, b.entry_time::text as entry_time,
        b.ticket_type::text as ticket_type, b.group_size, b.addons, b.total_paid_pence, b.refunded_pence, b.status::text as status, b.booked_at, s.year as season_year
      from crm.bookings b join crm.guests g on g.id = b.guest_id join crm.event_nights n on n.id = b.event_night_id join crm.seasons s on s.id = n.season_id
      where ${w}
      order by ${db.unsafe(SORT[p.sort])} ${dir}, b.entry_time ${dir}, b.id
      limit ${p.per} offset ${(p.page - 1) * p.per}`,
    db<{ total: number; revenue_pence: number }[]>`
      select count(*)::int as total, coalesce(sum(b.total_paid_pence - b.refunded_pence), 0)::int as revenue_pence
      from crm.bookings b join crm.guests g on g.id = b.guest_id join crm.event_nights n on n.id = b.event_night_id join crm.seasons s on s.id = n.season_id
      where ${w}`,
  ]);
  return { rows, total: agg!.total, revenue_pence: agg!.revenue_pence };
}

export interface NightSummary {
  id: string;
  date: string;
  season_year: number;
  capacity: number;
  booked: number;
  status: string;
}

export async function listNights(db: Db): Promise<NightSummary[]> {
  return db<NightSummary[]>`
    select n.id, n.date::text as date, s.year as season_year, n.capacity, n.status::text as status,
      coalesce((select sum(b.group_size) from crm.bookings b where b.event_night_id = n.id and b.status in ('confirmed','transferred')), 0)::int as booked
    from crm.event_nights n join crm.seasons s on s.id = n.season_id order by n.date desc`;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface BookingDetail extends BookingListRow {
  event_night_id: string;
  night_capacity: number;
  night_status: string;
  guest_phone: string | null;
  guest_banned: boolean;
  guest_accessibility: string | null;
  source_campaign_id: string | null;
  source_campaign_name: string | null;
  created_at: Date;
  updated_at: Date;
  survey_score: number | null;
  survey_comments: string | null;
  is_future: boolean;
}

export async function getBooking(db: Db, id: string): Promise<BookingDetail | null> {
  const rows = await db<BookingDetail[]>`
    select b.id, b.reference, b.guest_id, g.first_name || ' ' || g.last_name as guest_name, g.email as guest_email, g.phone as guest_phone, g.banned as guest_banned,
      g.accessibility_needs as guest_accessibility, n.id as event_night_id, n.date::text as date, n.capacity as night_capacity, n.status::text as night_status,
      b.entry_time::text as entry_time, b.ticket_type::text as ticket_type, b.group_size, b.addons, b.total_paid_pence, b.refunded_pence, b.status::text as status,
      b.booked_at, s.year as season_year, b.source_campaign_id, c.name as source_campaign_name, b.created_at, b.updated_at,
      (select overall_score from crm.surveys sv where sv.booking_id = b.id limit 1) as survey_score,
      (select comments from crm.surveys sv where sv.booking_id = b.id limit 1) as survey_comments,
      (n.date >= current_date) as is_future
    from crm.bookings b
    join crm.guests g on g.id = b.guest_id
    join crm.event_nights n on n.id = b.event_night_id
    join crm.seasons s on s.id = n.season_id
    left join crm.campaigns c on c.id = b.source_campaign_id
    where b.id = ${id}`;
  return rows[0] ?? null;
}

export interface BookingRefund {
  id: string;
  amount_pence: number;
  reason: string;
  provider_reference: string | null;
  processed_by_name: string | null;
  ticket_id: string | null;
  ticket_number: number | null;
  created_at: Date;
}

export async function getBookingRefunds(db: Db, bookingId: string): Promise<BookingRefund[]> {
  return db<BookingRefund[]>`
    select r.id, r.amount_pence, r.reason, r.provider_reference, s.name as processed_by_name, r.ticket_id, t.number as ticket_number, r.created_at
    from crm.refunds r left join crm.staff_users s on s.id = r.processed_by left join crm.tickets t on t.id = r.ticket_id
    where r.booking_id = ${bookingId} order by r.created_at desc`;
}

export async function getBookingTickets(db: Db, bookingId: string) {
  return db<{ id: string; number: number; subject: string; status: string; created_at: Date }[]>`
    select id, number, subject, status::text as status, created_at from crm.tickets where booking_id = ${bookingId} order by created_at desc`;
}

export async function getBookingMessages(db: Db, bookingReference: string, guestId: string) {
  return db<{ id: string; subject: string | null; channel: string; sent_at: Date; opened_at: Date | null }[]>`
    select id, subject, channel::text as channel, sent_at, opened_at from crm.messages_outbox
    where guest_id = ${guestId} and (subject ilike ${"%" + bookingReference + "%"} or body_text ilike ${"%" + bookingReference + "%"})
    order by sent_at desc limit 20`;
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export const bookingEditSchema = z.object({
  event_night_id: z.string().uuid("Choose a night"),
  entry_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose an entry time"),
  ticket_type: z.enum(["standard", "fast_track", "vip", "group"]),
  group_size: z.coerce.number().int().min(1, "At least one person").max(60, "Group bookings are capped at 60"),
  addons: z.array(z.enum(["photo_pack", "merch_bundle", "food_voucher"])).default([]),
  total_paid_pence: z.coerce.number().int().min(0, "Cannot be negative").max(10_000_000),
  status: z.enum(["confirmed", "refunded", "transferred", "no_show"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
export type BookingEditInput = z.infer<typeof bookingEditSchema>;

const FIELD_LABELS: Record<string, string> = {
  event_night_id: "night",
  entry_time: "entry time",
  ticket_type: "ticket type",
  group_size: "group size",
  addons: "add-ons",
  total_paid_pence: "total paid",
  status: "status",
};

/**
 * Applies edits to a booking. Capacity is checked when the night or party
 * size changes; refunded amounts are protected so the paid total can never
 * drop below what has already been refunded.
 */
export async function updateBooking(db: Db, staff: StaffUser, id: string, input: BookingEditInput): Promise<string[]> {
  const before = await getBooking(db, id);
  if (!before) throw new Error("Booking not found");
  if (input.total_paid_pence < before.refunded_pence) throw new Error(`Total paid cannot be below the ${formatMoney(before.refunded_pence)} already refunded.`);
  if (input.status === "refunded" && input.total_paid_pence - before.refunded_pence > 0) {
    throw new Error("Use the Refund action to refund money. The status becomes Refunded automatically once nothing is left to refund.");
  }
  if (before.status === "refunded" && input.status !== "refunded") throw new Error("A fully refunded booking cannot be reinstated.");

  const nightChanged = input.event_night_id !== before.event_night_id;
  const sizeChanged = input.group_size !== before.group_size;
  const counts = input.status === "confirmed" || input.status === "transferred";
  if ((nightChanged || sizeChanged) && counts) {
    const [night] = await db<{ date: string; capacity: number; status: string; booked: number }[]>`
      select n.date::text as date, n.capacity, n.status::text as status,
        coalesce((select sum(b.group_size) from crm.bookings b where b.event_night_id = n.id and b.status in ('confirmed','transferred') and b.id <> ${id}), 0)::int as booked
      from crm.event_nights n where n.id = ${input.event_night_id}`;
    if (!night) throw new Error("Night not found");
    if (night.status === "cancelled") throw new Error(`${formatDateOnly(night.date)} is cancelled.`);
    if (night.capacity - night.booked < input.group_size) throw new Error(`Not enough space on ${formatDateOnly(night.date)}: ${night.capacity - night.booked} places left, ${input.group_size} needed.`);
  }

  const status = nightChanged && input.status === "confirmed" ? "transferred" : input.status;
  await db`
    update crm.bookings set event_night_id = ${input.event_night_id}, entry_time = ${input.entry_time}, ticket_type = ${input.ticket_type}::ticket_type,
      group_size = ${input.group_size}, addons = ${input.addons}, total_paid_pence = ${input.total_paid_pence}, status = ${status}::booking_status
    where id = ${id}`;

  // Keep the guest's lifetime spend in step with the paid total.
  const delta = input.total_paid_pence - before.total_paid_pence;
  if (delta !== 0) await db`update crm.guests set lifetime_spend_pence = greatest(0, lifetime_spend_pence + ${delta}) where id = ${before.guest_id}`;

  const after = await getBooking(db, id);
  const changes: string[] = [];
  for (const key of Object.keys(FIELD_LABELS)) {
    const a = JSON.stringify((before as unknown as Record<string, unknown>)[key]);
    const b = JSON.stringify((after as unknown as Record<string, unknown>)[key]);
    if (a !== b) {
      if (key === "event_night_id") changes.push(`night ${formatDateOnly(before.date)} → ${formatDateOnly(after!.date)}`);
      else if (key === "total_paid_pence") changes.push(`total paid ${formatMoney(before.total_paid_pence)} → ${formatMoney(after!.total_paid_pence)}`);
      else {
        const show = (v: unknown) => (Array.isArray(v) ? (v.length ? v.map((x) => String(x).replace(/_/g, " ")).join(", ") : "none") : String(v).replace(/_/g, " "));
        changes.push(`${FIELD_LABELS[key]} ${show((before as unknown as Record<string, unknown>)[key])} → ${show((after as unknown as Record<string, unknown>)[key])}`);
      }
    }
  }
  if (changes.length || input.note) {
    await logActivity(db, staff, {
      action: "booking.updated",
      entityType: "booking",
      entityId: id,
      summary: `${before.reference}: ${changes.length ? changes.join(", ") : "no field changes"}${input.note ? ` (${input.note})` : ""}`,
      details: { changes, note: input.note || null },
    });
    await logActivity(db, staff, { action: "guest.booking_updated", entityType: "guest", entityId: before.guest_id, summary: `Booking ${before.reference} edited: ${changes.join(", ") || "note added"}`, details: { booking_id: id } });
  }
  return changes;
}

export async function listBookingActivity(db: Db, id: string) {
  return db<{ id: number; staff_name: string | null; action: string; summary: string; created_at: Date }[]>`
    select id, staff_name, action, summary, created_at from crm.activity_log where entity_type = 'booking' and entity_id = ${id} order by created_at desc limit 50`;
}
