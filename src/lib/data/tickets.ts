import { z } from "zod";
import type { Db } from "@/lib/db/client";
import type { StaffUser } from "@/lib/auth/types";
import { computeDueAt, type Priority, type SlaPolicies } from "@/lib/support/sla";
import { planRefund, type RefundRequest } from "@/lib/support/refunds";
import { processRefund, registerVoucher } from "@/lib/payments/provider";
import { sendEmail } from "@/lib/messaging/provider";
import { renderMergeFields, type MergeValues } from "@/lib/messaging/merge";
import { renderPlainEmailHtml } from "@/lib/messaging/email-blocks";
import { brandingFrom, getParkSettings } from "./settings";
import { logActivity } from "./activity";
import { formatClock, formatDateOnly, formatMoney } from "@/lib/format";
import { TICKET_TYPE_LABELS } from "@/lib/domain/constants";

export type TicketStatus = "new" | "open" | "waiting_on_guest" | "resolved";

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export const ticketListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", "unresolved", "new", "open", "waiting_on_guest", "resolved"]).optional().default("unresolved"),
  category: z.string().trim().max(40).optional().default(""),
  priority: z.enum(["", "low", "normal", "high", "urgent"]).optional().default(""),
  mine: z.enum(["", "1"]).optional().default(""),
  overdue: z.enum(["", "1"]).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
});
export type TicketListParams = z.infer<typeof ticketListParamsSchema>;

export interface TicketListRow {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  requester_name: string;
  requester_email: string;
  guest_id: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  sla_due_at: Date;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  last_message_at: Date;
  last_direction: "inbound" | "outbound" | "internal_note" | null;
  message_count: number;
}

const PAGE = 40;

export async function listTickets(db: Db, p: TicketListParams, staffId: string): Promise<{ rows: TicketListRow[]; total: number; counts: Record<string, number> }> {
  const conds = [];
  if (p.q) {
    const like = `%${p.q.replace(/[%_]/g, (m) => "\\" + m)}%`;
    const num = /^#?(\d+)$/.exec(p.q)?.[1];
    conds.push(db`(t.subject ilike ${like} or t.requester_name ilike ${like} or t.requester_email ilike ${like} ${num ? db`or t.number = ${Number(num)}` : db``})`);
  }
  if (p.status === "unresolved") conds.push(db`t.status <> 'resolved'`);
  else if (p.status !== "all") conds.push(db`t.status = ${p.status}::ticket_status`);
  if (p.category) conds.push(db`t.category = ${p.category}`);
  if (p.priority) conds.push(db`t.priority = ${p.priority}::ticket_priority`);
  if (p.mine) conds.push(db`t.assigned_to = ${staffId}`);
  if (p.overdue) conds.push(db`t.status <> 'resolved' and t.sla_due_at < now()`);
  const where = conds.length ? conds.reduce((a, c) => db`${a} and ${c}`) : db`true`;
  const offset = (p.page - 1) * PAGE;

  const [rows, [{ count }], countRows] = await Promise.all([
    db<TicketListRow[]>`
      select t.id, t.number, t.subject, t.category, t.priority::text as priority, t.status::text as status, t.requester_name, t.requester_email, t.guest_id,
        t.assigned_to, s.name as assigned_name, t.sla_due_at, t.created_at, t.updated_at, t.resolved_at,
        coalesce((select max(m.sent_at) from crm.ticket_messages m where m.ticket_id = t.id), t.created_at) as last_message_at,
        (select m.direction::text from crm.ticket_messages m where m.ticket_id = t.id order by m.sent_at desc limit 1) as last_direction,
        (select count(*) from crm.ticket_messages m where m.ticket_id = t.id)::int as message_count
      from crm.tickets t left join crm.staff_users s on s.id = t.assigned_to
      where ${where}
      order by (t.status = 'resolved'), (case when t.status <> 'resolved' and t.sla_due_at < now() then 0 else 1 end), t.sla_due_at asc, t.created_at desc
      limit ${PAGE} offset ${offset}`,
    db<{ count: number }[]>`select count(*)::int as count from crm.tickets t where ${where}`,
    db<{ key: string; n: number }[]>`
      select 'unresolved' as key, count(*)::int as n from crm.tickets where status <> 'resolved'
      union all select 'new', count(*)::int from crm.tickets where status = 'new'
      union all select 'overdue', count(*)::int from crm.tickets where status <> 'resolved' and sla_due_at < now()
      union all select 'mine', count(*)::int from crm.tickets where status <> 'resolved' and assigned_to = ${staffId}
      union all select 'complaints', count(*)::int from crm.tickets where status <> 'resolved' and category = 'complaint'`,
  ]);
  return { rows, total: count, counts: Object.fromEntries(countRows.map((r) => [r.key, r.n])) };
}

// ---------------------------------------------------------------------------
// Ticket detail and guest context
// ---------------------------------------------------------------------------

export interface TicketDetail extends TicketListRow {
  booking_id: string | null;
  booking_reference: string | null;
  source: "email" | "web_form";
  first_response_at: Date | null;
  root_cause: string | null;
  final_response: string | null;
}

export interface TicketMessage {
  id: string;
  direction: "inbound" | "outbound" | "internal_note";
  author_staff_id: string | null;
  author_name: string;
  body: string;
  sent_at: Date;
}

export async function getTicket(db: Db, id: string): Promise<TicketDetail | null> {
  const rows = await db<TicketDetail[]>`
    select t.id, t.number, t.subject, t.category, t.priority::text as priority, t.status::text as status, t.requester_name, t.requester_email, t.guest_id,
      t.assigned_to, s.name as assigned_name, t.sla_due_at, t.created_at, t.updated_at, t.resolved_at, t.booking_id, b.reference as booking_reference,
      t.source::text as source, t.first_response_at, t.root_cause, t.final_response,
      coalesce((select max(m.sent_at) from crm.ticket_messages m where m.ticket_id = t.id), t.created_at) as last_message_at,
      (select m.direction::text from crm.ticket_messages m where m.ticket_id = t.id order by m.sent_at desc limit 1) as last_direction,
      (select count(*) from crm.ticket_messages m where m.ticket_id = t.id)::int as message_count
    from crm.tickets t
    left join crm.staff_users s on s.id = t.assigned_to
    left join crm.bookings b on b.id = t.booking_id
    where t.id = ${id}`;
  return rows[0] ?? null;
}

export async function getTicketMessages(db: Db, ticketId: string): Promise<TicketMessage[]> {
  return db<TicketMessage[]>`
    select id, direction::text as direction, author_staff_id, author_name, body, sent_at from crm.ticket_messages where ticket_id = ${ticketId} order by sent_at, id`;
}

export interface ContextBooking {
  id: string;
  reference: string;
  date: string;
  entry_time: string;
  ticket_type: string;
  group_size: number;
  total_paid_pence: number;
  refunded_pence: number;
  status: string;
  night_id: string;
  is_future: boolean;
}

export interface GuestContext {
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    postcode: string | null;
    tags: string[];
    accessibility_needs: string | null;
    do_not_touch: boolean;
    banned: boolean;
    banned_reason: string | null;
    notes: string | null;
    lifetime_spend_pence: number;
    visit_count: number;
    email_consent: boolean;
    sms_consent: boolean;
  } | null;
  bookings: ContextBooking[];
  previousTickets: Array<{ id: string; number: number; subject: string; status: TicketStatus; category: string; created_at: Date }>;
  vouchers: Array<{ code: string; amount_pence: number; expires_on: string; redeemed_at: Date | null }>;
}

export async function getGuestContext(db: Db, ticket: TicketDetail): Promise<GuestContext> {
  const guestRows = ticket.guest_id
    ? await db<NonNullable<GuestContext["guest"]>[]>`
        select id, first_name, last_name, email, phone, postcode, tags, accessibility_needs, do_not_touch, banned, banned_reason, notes, lifetime_spend_pence, visit_count, email_consent, sms_consent
        from crm.guests where id = ${ticket.guest_id}`
    : [];
  const guest = guestRows[0] ?? null;
  if (!guest) return { guest: null, bookings: [], previousTickets: [], vouchers: [] };
  const [bookings, previousTickets, vouchers] = await Promise.all([
    db<ContextBooking[]>`
      select b.id, b.reference, n.date::text as date, b.entry_time::text as entry_time, b.ticket_type::text as ticket_type, b.group_size, b.total_paid_pence, b.refunded_pence, b.status::text as status,
        n.id as night_id, (n.date >= current_date) as is_future
      from crm.bookings b join crm.event_nights n on n.id = b.event_night_id where b.guest_id = ${guest.id} order by n.date desc limit 12`,
    db<GuestContext["previousTickets"]>`
      select id, number, subject, status::text as status, category, created_at from crm.tickets where guest_id = ${guest.id} and id <> ${ticket.id} order by created_at desc limit 8`,
    db<GuestContext["vouchers"]>`select code, amount_pence, expires_on::text, redeemed_at from crm.vouchers where guest_id = ${guest.id} order by created_at desc limit 5`,
  ]);
  return { guest, bookings, previousTickets, vouchers };
}

export interface NightOption {
  id: string;
  date: string;
  capacity: number;
  booked: number;
  status: string;
}

/** Future nights with space, for moving a booking. */
export async function listMoveTargets(db: Db, groupSize: number, excludeNightId: string): Promise<NightOption[]> {
  return db<NightOption[]>`
    select n.id, n.date::text as date, n.capacity, n.status::text as status,
      coalesce((select sum(b.group_size) from crm.bookings b where b.event_night_id = n.id and b.status in ('confirmed','transferred')), 0)::int as booked
    from crm.event_nights n
    where n.date >= current_date and n.status <> 'cancelled' and n.id <> ${excludeNightId}
      and n.capacity - coalesce((select sum(b.group_size) from crm.bookings b where b.event_night_id = n.id and b.status in ('confirmed','transferred')), 0) >= ${groupSize}
    order by n.date`;
}

// ---------------------------------------------------------------------------
// Creating tickets
// ---------------------------------------------------------------------------

export const newTicketSchema = z.object({
  requester_name: z.string().trim().min(2, "Enter the guest's name").max(100),
  requester_email: z.string().trim().email("Enter a valid email address").max(120),
  subject: z.string().trim().min(3, "Enter a subject").max(150),
  body: z.string().trim().min(5, "Describe the issue").max(5000),
  category: z.string().trim().min(1, "Choose a category").max(40),
  booking_reference: z.string().trim().max(12).optional().or(z.literal("")),
  source: z.enum(["email", "web_form"]).default("web_form"),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});
export type NewTicketInput = z.infer<typeof newTicketSchema>;

/** Creates a ticket, matching the guest by email and the booking by reference where possible. */
export async function createTicket(db: Db, input: NewTicketInput, sla: SlaPolicies, opts: { staffId?: string | null } = {}): Promise<{ id: string; number: number }> {
  const [guest] = await db<{ id: string; first_name: string; last_name: string }[]>`select id, first_name, last_name from crm.guests where lower(email) = lower(${input.requester_email})`;
  const [cat] = await db<{ default_priority: Priority }[]>`select default_priority::text as default_priority from crm.ticket_categories where key = ${input.category} and active`;
  if (!cat) throw new Error("Unknown ticket category");
  const priority: Priority = input.priority ?? cat.default_priority;
  let bookingId: string | null = null;
  if (input.booking_reference) {
    const ref = input.booking_reference.toUpperCase().replace(/\s+/g, "");
    const [b] = await db<{ id: string }[]>`select id from crm.bookings where upper(reference) = ${ref.startsWith("BTH-") ? ref : "BTH-" + ref} ${guest ? db`and guest_id = ${guest.id}` : db``}`;
    bookingId = b?.id ?? null;
  }
  const createdAt = new Date();
  const [t] = await db<{ id: string; number: number }[]>`
    insert into crm.tickets (guest_id, requester_name, requester_email, booking_id, subject, category, priority, status, source, sla_due_at)
    values (${guest?.id ?? null}, ${input.requester_name}, ${input.requester_email.toLowerCase()}, ${bookingId}, ${input.subject}, ${input.category}, ${priority}, 'new', ${input.source}, ${computeDueAt(createdAt, priority, sla)})
    returning id, number`;
  await db`insert into crm.ticket_messages (ticket_id, direction, author_staff_id, author_name, body) values (${t!.id}, 'inbound', ${opts.staffId ?? null}, ${input.requester_name}, ${input.body})`;
  return t!;
}

// ---------------------------------------------------------------------------
// Updates and replies
// ---------------------------------------------------------------------------

export const ticketFieldsSchema = z.object({
  status: z.enum(["new", "open", "waiting_on_guest", "resolved"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  root_cause: z.string().trim().max(40).nullable().optional(),
  final_response: z.string().trim().max(5000).nullable().optional(),
});
export type TicketFieldsInput = z.infer<typeof ticketFieldsSchema>;

export class ComplaintRuleError extends Error {}

/**
 * Applies field changes. Complaints cannot be resolved without a root cause
 * tag and a final response: that is the one business rule enforced here.
 */
export async function updateTicketFields(db: Db, staff: StaffUser, ticket: TicketDetail, input: TicketFieldsInput, sla: SlaPolicies): Promise<string[]> {
  const next = {
    status: input.status ?? ticket.status,
    priority: input.priority ?? ticket.priority,
    category: input.category ?? ticket.category,
    assigned_to: input.assigned_to === undefined ? ticket.assigned_to : input.assigned_to,
    root_cause: input.root_cause === undefined ? ticket.root_cause : input.root_cause || null,
    final_response: input.final_response === undefined ? ticket.final_response : input.final_response || null,
  };
  if (next.status === "resolved" && next.category === "complaint") {
    if (!next.root_cause) throw new ComplaintRuleError("Complaints need a root cause tag before they can be resolved.");
    if (!next.final_response || next.final_response.trim().length < 20) throw new ComplaintRuleError("Complaints need a final response (at least 20 characters) before they can be resolved.");
  }
  const changes: string[] = [];
  if (next.status !== ticket.status) changes.push(`status ${ticket.status.replace(/_/g, " ")} → ${next.status.replace(/_/g, " ")}`);
  if (next.priority !== ticket.priority) changes.push(`priority ${ticket.priority} → ${next.priority}`);
  if (next.category !== ticket.category) changes.push(`category ${ticket.category} → ${next.category}`);
  if (next.assigned_to !== ticket.assigned_to) {
    const [who] = next.assigned_to ? await db<{ name: string }[]>`select name from crm.staff_users where id = ${next.assigned_to}` : [];
    changes.push(next.assigned_to ? `assigned to ${who?.name ?? "staff"}` : "unassigned");
  }
  if (next.root_cause !== ticket.root_cause) changes.push(`root cause ${next.root_cause ?? "cleared"}`);
  if (next.final_response !== ticket.final_response) changes.push("final response updated");

  // Re-time the SLA when priority changes and the ticket is still open.
  const dueAt = next.priority !== ticket.priority && next.status !== "resolved" ? computeDueAt(ticket.created_at, next.priority, sla) : ticket.sla_due_at;
  await db`
    update crm.tickets set status = ${next.status}::ticket_status, priority = ${next.priority}::ticket_priority, category = ${next.category},
      assigned_to = ${next.assigned_to}, root_cause = ${next.root_cause}, final_response = ${next.final_response}, sla_due_at = ${dueAt},
      resolved_at = case when ${next.status} = 'resolved' then coalesce(resolved_at, now()) else null end
    where id = ${ticket.id}`;
  if (changes.length) {
    await logActivity(db, staff, { action: "ticket.updated", entityType: "ticket", entityId: ticket.id, summary: `#${ticket.number}: ${changes.join(", ")}`, details: input as Record<string, unknown> });
  }
  return changes;
}

export const replySchema = z.object({
  body: z.string().trim().min(1, "Write a message first").max(10000),
  kind: z.enum(["reply", "note"]),
  set_status: z.enum(["", "open", "waiting_on_guest", "resolved"]).optional().default(""),
});

/** Outbound replies also go to the outbox so the guest "receives" them. */
export async function addTicketMessage(db: Db, staff: StaffUser, ticket: TicketDetail, body: string, kind: "reply" | "note"): Promise<void> {
  const direction = kind === "reply" ? "outbound" : "internal_note";
  await db`insert into crm.ticket_messages (ticket_id, direction, author_staff_id, author_name, body) values (${ticket.id}, ${direction}, ${staff.id}, ${staff.name}, ${body})`;
  if (kind === "reply") {
    const settings = await getParkSettings(db);
    await sendEmail(db, {
      guestId: ticket.guest_id,
      to: ticket.requester_email,
      toName: ticket.requester_name,
      subject: `Re: ${ticket.subject} [#${ticket.number}]`,
      html: renderPlainEmailHtml(body, brandingFrom(settings)),
      text: body,
      ticketId: ticket.id,
    });
    await db`update crm.tickets set first_response_at = coalesce(first_response_at, now()), status = case when status = 'new' then 'open'::ticket_status else status end where id = ${ticket.id}`;
    await logActivity(db, staff, { action: "ticket.replied", entityType: "ticket", entityId: ticket.id, summary: `Replied to #${ticket.number}` });
  } else {
    await logActivity(db, staff, { action: "ticket.note_added", entityType: "ticket", entityId: ticket.id, summary: `Added an internal note to #${ticket.number}` });
  }
}

/** Merge values for saved replies and AI drafts on this ticket. */
export async function ticketMergeValues(db: Db, ticket: TicketDetail, staff: StaffUser, extra: MergeValues = {}): Promise<MergeValues> {
  const settings = await getParkSettings(db);
  const [b] = ticket.booking_id
    ? await db<{ reference: string; date: string; entry_time: string; ticket_type: string; group_size: number }[]>`
        select b.reference, n.date::text, b.entry_time::text, b.ticket_type::text, b.group_size from crm.bookings b join crm.event_nights n on n.id = b.event_night_id where b.id = ${ticket.booking_id}`
    : [];
  const [first, ...rest] = ticket.requester_name.split(" ");
  return {
    first_name: first,
    last_name: rest.join(" "),
    full_name: ticket.requester_name,
    email: ticket.requester_email,
    booking_reference: b?.reference ?? ticket.booking_reference ?? "",
    visit_date: b ? formatDateOnly(b.date) : "",
    entry_time: b ? formatClock(b.entry_time) : "",
    ticket_type: b ? TICKET_TYPE_LABELS[b.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? b.ticket_type : "",
    group_size: b?.group_size,
    park_name: settings.name,
    support_email: settings.support_email,
    ticket_number: `#${ticket.number}`,
    staff_name: staff.name.split(" ")[0],
    ...extra,
  };
}

export function renderSavedReply(body: string, values: MergeValues): string {
  return renderMergeFields(body, values);
}

// ---------------------------------------------------------------------------
// Simulated actions: refund, move booking, resend tickets, voucher
// ---------------------------------------------------------------------------

export const refundSchema = z.object({
  booking_id: z.string().uuid(),
  kind: z.enum(["full", "partial"]),
  amount_pence: z.coerce.number().int().optional(),
  reason: z.string().trim().min(3, "Give a reason for the refund").max(300),
});

export async function refundBooking(db: Db, staff: StaffUser, ticket: TicketDetail, input: z.infer<typeof refundSchema>): Promise<string> {
  const [booking] = await db<{ id: string; reference: string; total_paid_pence: number; refunded_pence: number; status: string; guest_id: string }[]>`
    select id, reference, total_paid_pence, refunded_pence, status::text as status, guest_id from crm.bookings where id = ${input.booking_id} for update`;
  if (!booking) throw new Error("Booking not found");
  if (ticket.guest_id && booking.guest_id !== ticket.guest_id) throw new Error("That booking belongs to a different guest");
  const plan = planRefund(booking, { kind: input.kind, amount_pence: input.amount_pence } satisfies RefundRequest);
  const receipt = await processRefund({ bookingReference: booking.reference, amountPence: plan.amount_pence, reason: input.reason });
  await db`insert into crm.refunds (booking_id, ticket_id, amount_pence, reason, processed_by, provider_reference) values (${booking.id}, ${ticket.id}, ${plan.amount_pence}, ${input.reason}, ${staff.id}, ${receipt.providerReference})`;
  await db`update crm.bookings set refunded_pence = ${plan.new_refunded_pence}, status = ${plan.new_status}::booking_status where id = ${booking.id}`;
  await db`update crm.guests set lifetime_spend_pence = greatest(0, lifetime_spend_pence - ${plan.amount_pence}) where id = ${booking.guest_id}`;
  const summary = `Refunded ${formatMoney(plan.amount_pence)} on ${booking.reference} (${input.kind}${plan.new_status === "refunded" ? ", booking now fully refunded" : ""}). Simulated provider ref ${receipt.providerReference}.`;
  await db`insert into crm.ticket_messages (ticket_id, direction, author_staff_id, author_name, body) values (${ticket.id}, 'internal_note', ${staff.id}, ${staff.name}, ${"Action: " + summary + " Reason: " + input.reason})`;
  await logActivity(db, staff, { action: "booking.refunded", entityType: "booking", entityId: booking.id, summary, details: { ticket_id: ticket.id, ...plan, provider_reference: receipt.providerReference } });
  return summary;
}

export const moveSchema = z.object({ booking_id: z.string().uuid(), night_id: z.string().uuid(), entry_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose an entry time") });

export async function moveBooking(db: Db, staff: StaffUser, ticket: TicketDetail, input: z.infer<typeof moveSchema>): Promise<string> {
  const [booking] = await db<{ id: string; reference: string; group_size: number; event_night_id: string; status: string; guest_id: string; old_date: string }[]>`
    select b.id, b.reference, b.group_size, b.event_night_id, b.status::text as status, b.guest_id, n.date::text as old_date
    from crm.bookings b join crm.event_nights n on n.id = b.event_night_id where b.id = ${input.booking_id} for update of b`;
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "refunded") throw new Error("A refunded booking cannot be moved");
  const [night] = await db<{ id: string; date: string; capacity: number; booked: number; status: string }[]>`
    select n.id, n.date::text as date, n.capacity, n.status::text as status,
      coalesce((select sum(b.group_size) from crm.bookings b where b.event_night_id = n.id and b.status in ('confirmed','transferred')), 0)::int as booked
    from crm.event_nights n where n.id = ${input.night_id}`;
  if (!night) throw new Error("Night not found");
  if (night.status === "cancelled") throw new Error("That night is cancelled");
  if (night.capacity - night.booked < booking.group_size) throw new Error(`Not enough space on ${formatDateOnly(night.date)}: ${night.capacity - night.booked} places left, ${booking.group_size} needed.`);
  await db`update crm.bookings set event_night_id = ${night.id}, entry_time = ${input.entry_time}, status = 'transferred' where id = ${booking.id}`;
  const summary = `Moved ${booking.reference} from ${formatDateOnly(booking.old_date)} to ${formatDateOnly(night.date)} at ${input.entry_time}.`;
  await db`insert into crm.ticket_messages (ticket_id, direction, author_staff_id, author_name, body) values (${ticket.id}, 'internal_note', ${staff.id}, ${staff.name}, ${"Action: " + summary})`;
  await logActivity(db, staff, { action: "booking.moved", entityType: "booking", entityId: booking.id, summary, details: { ticket_id: ticket.id, from_night: booking.event_night_id, to_night: night.id } });
  return summary;
}

export async function resendTickets(db: Db, staff: StaffUser, ticket: TicketDetail, bookingId: string): Promise<string> {
  const [b] = await db<{ reference: string; date: string; entry_time: string; ticket_type: string; group_size: number; guest_id: string; first_name: string; email: string; last_name: string }[]>`
    select b.reference, n.date::text, b.entry_time::text, b.ticket_type::text, b.group_size, b.guest_id, g.first_name, g.last_name, g.email
    from crm.bookings b join crm.event_nights n on n.id = b.event_night_id join crm.guests g on g.id = b.guest_id where b.id = ${bookingId}`;
  if (!b) throw new Error("Booking not found");
  const settings = await getParkSettings(db);
  const text = `Hi ${b.first_name},\n\nHere are your tickets again.\n\nBooking reference: ${b.reference}\nDate: ${formatDateOnly(b.date)}\nEntry time: ${formatClock(b.entry_time)}\nTickets: ${b.group_size} x ${TICKET_TYPE_LABELS[b.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? b.ticket_type}\n\nShow this email at the box office. See you in the dark.\n\n${settings.name}`;
  await sendEmail(db, { guestId: b.guest_id, to: ticket.requester_email, toName: `${b.first_name} ${b.last_name}`, subject: `Your tickets for ${settings.name}: ${b.reference}`, html: renderPlainEmailHtml(text, brandingFrom(settings)), text, ticketId: ticket.id });
  const summary = `Resent tickets for ${b.reference} to ${ticket.requester_email}.`;
  await db`insert into crm.ticket_messages (ticket_id, direction, author_staff_id, author_name, body) values (${ticket.id}, 'internal_note', ${staff.id}, ${staff.name}, ${"Action: " + summary})`;
  await logActivity(db, staff, { action: "booking.tickets_resent", entityType: "booking", entityId: bookingId, summary, details: { ticket_id: ticket.id } });
  return summary;
}

export const voucherSchema = z.object({
  amount_pence: z.coerce.number().int().min(100, "Vouchers start at £1").max(100000, "Vouchers are capped at £1,000"),
  reason: z.string().trim().min(3, "Give a reason").max(300),
  months_valid: z.coerce.number().int().min(1).max(36).default(12),
});

export async function issueVoucher(db: Db, staff: StaffUser, ticket: TicketDetail, input: z.infer<typeof voucherSchema>): Promise<{ code: string; summary: string }> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  code = `BTV-${code}`;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + input.months_valid);
  const expiresOn = expires.toISOString().slice(0, 10);
  await registerVoucher({ code, amountPence: input.amount_pence, expiresOn });
  await db`insert into crm.vouchers (code, guest_id, ticket_id, amount_pence, reason, expires_on, issued_by) values (${code}, ${ticket.guest_id}, ${ticket.id}, ${input.amount_pence}, ${input.reason}, ${expiresOn}, ${staff.id})`;
  const settings = await getParkSettings(db);
  const text = `Hi ${ticket.requester_name.split(" ")[0]},\n\nWe've issued you a voucher for ${formatMoney(input.amount_pence)}.\n\nCode: ${code}\nValid until: ${formatDateOnly(expiresOn)}\n\nEnter it at checkout on ${settings.website} on any night this season or next.\n\n${staff.name.split(" ")[0]}\n${settings.name} Guest Support`;
  await sendEmail(db, { guestId: ticket.guest_id, to: ticket.requester_email, toName: ticket.requester_name, subject: `Your ${settings.name} voucher ${code}`, html: renderPlainEmailHtml(text, brandingFrom(settings)), text, ticketId: ticket.id });
  const summary = `Issued voucher ${code} for ${formatMoney(input.amount_pence)}, valid until ${formatDateOnly(expiresOn)}.`;
  await db`insert into crm.ticket_messages (ticket_id, direction, author_staff_id, author_name, body) values (${ticket.id}, 'internal_note', ${staff.id}, ${staff.name}, ${"Action: " + summary + " Reason: " + input.reason})`;
  await logActivity(db, staff, { action: "voucher.issued", entityType: "ticket", entityId: ticket.id, summary, details: { code, amount_pence: input.amount_pence } });
  return { code, summary };
}
