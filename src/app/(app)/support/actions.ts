"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { canManageSupport } from "@/lib/auth/types";
import { logActivity } from "@/lib/data/activity";
import { getSupportConfig } from "@/lib/data/support-config";
import {
  addTicketMessage,
  createTicket,
  getTicket,
  issueVoucher,
  listMoveTargets,
  moveBooking,
  moveSchema,
  newTicketSchema,
  refundBooking,
  refundSchema,
  renderSavedReply,
  replySchema,
  resendTickets,
  ticketFieldsSchema,
  ticketMergeValues,
  updateTicketFields,
  voucherSchema,
} from "@/lib/data/tickets";
import { SIMULATED_INBOUND } from "@/lib/support/simulated-inbound";
import { renderMergeFields } from "@/lib/messaging/merge";
import { RefundError } from "@/lib/support/refunds";
import { errorMessage } from "@/lib/utils";

export type SupportResult = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function friendly(err: unknown): string {
  if (isPermissionError(err)) return "Your role is not allowed to do that.";
  if (err instanceof RefundError) return err.message;
  return errorMessage(err);
}

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

function revalidateTicket(id: string) {
  revalidatePath("/support");
  revalidatePath(`/support/${id}`);
}

/** Creates a believable new ticket from a random guest so the inbound flow can be demonstrated live. */
export async function simulateInboundEmail(): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role) && staff.role !== "front_desk") return { ok: false, error: "Your role is not allowed to create tickets." };
  try {
    const id = await withStaff(staff, async (db) => {
      const [g] = await db<{ id: string; first_name: string; last_name: string; email: string; reference: string | null; date: string | null }[]>`
        select g.id, g.first_name, g.last_name, g.email, b.reference, n.date::text as date
        from crm.guests g
        left join lateral (select b.reference, b.event_night_id from crm.bookings b where b.guest_id = g.id and b.status <> 'refunded' order by b.booked_at desc limit 1) b on true
        left join crm.event_nights n on n.id = b.event_night_id
        where not g.banned and b.reference is not null
        order by random() limit 1`;
      if (!g) throw new Error("No guests to simulate from. Run the seed first.");
      const tpl = SIMULATED_INBOUND[Math.floor(Math.random() * SIMULATED_INBOUND.length)]!;
      const values = { first_name: g.first_name, last_name: g.last_name, booking_reference: g.reference ?? "", visit_date: g.date ? g.date.split("-").reverse().join("/") : "" };
      const config = await getSupportConfig(db);
      const t = await createTicket(
        db,
        {
          requester_name: `${g.first_name} ${g.last_name}`,
          requester_email: g.email,
          subject: renderMergeFields(tpl.subject, values),
          body: renderMergeFields(tpl.body, values),
          category: tpl.category,
          booking_reference: g.reference ?? "",
          source: tpl.source,
        },
        config.sla,
      );
      await logActivity(db, staff, { action: "ticket.simulated", entityType: "ticket", entityId: t.id, summary: `Simulated an inbound ${tpl.source === "email" ? "email" : "web form"} as #${t.number}` });
      return t.id;
    });
    revalidatePath("/support");
    redirect(`/support/${id}`);
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return { ok: false, error: friendly(err) };
  }
}

export async function createTicketAction(input: unknown): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role) && staff.role !== "front_desk") return { ok: false, error: "Your role is not allowed to create tickets." };
  const parsed = newTicketSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const id = await withStaff(staff, async (db) => {
      const config = await getSupportConfig(db);
      const t = await createTicket(db, parsed.data, config.sla, { staffId: staff.id });
      await logActivity(db, staff, { action: "ticket.created", entityType: "ticket", entityId: t.id, summary: `Raised #${t.number} "${parsed.data.subject}" for ${parsed.data.requester_name}` });
      return t.id;
    });
    revalidatePath("/support");
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function updateTicket(ticketId: string, input: unknown): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role)) return { ok: false, error: "Your role is not allowed to change tickets." };
  const parsed = ticketFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid change.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const changes = await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      const config = await getSupportConfig(db);
      return updateTicketFields(db, staff, ticket, parsed.data, config.sla);
    });
    revalidateTicket(ticketId);
    return { ok: true, message: changes.length ? `Updated: ${changes.join(", ")}` : undefined };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function replyToTicket(ticketId: string, input: unknown): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role) && staff.role !== "front_desk") return { ok: false, error: "Your role is not allowed to reply." };
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Write a message first." };
  try {
    await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      await addTicketMessage(db, staff, ticket, parsed.data.body, parsed.data.kind);
      if (parsed.data.set_status) {
        const config = await getSupportConfig(db);
        const fresh = (await getTicket(db, ticketId))!;
        await updateTicketFields(db, staff, fresh, { status: parsed.data.set_status }, config.sla);
      }
    });
    revalidateTicket(ticketId);
    revalidatePath("/outbox");
    return { ok: true, message: parsed.data.kind === "reply" ? "Reply sent to the outbox." : "Note added." };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

/** Fills the merge fields of a saved reply for this ticket and returns the text for the composer. */
export async function fillSavedReply(ticketId: string, savedReplyId: string): Promise<SupportResult> {
  const staff = await requireStaff();
  try {
    const text = await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      const [reply] = await db<{ body: string }[]>`select body from crm.saved_replies where id = ${savedReplyId}`;
      if (!reply) throw new Error("Saved reply not found");
      const [voucher] = await db<{ code: string }[]>`select code from crm.vouchers where ticket_id = ${ticketId} order by created_at desc limit 1`;
      const [refund] = await db<{ amount_pence: number }[]>`select amount_pence from crm.refunds where ticket_id = ${ticketId} order by created_at desc limit 1`;
      const values = await ticketMergeValues(db, ticket, staff, {
        voucher_code: voucher?.code ?? "",
        refund_amount: refund ? `£${(refund.amount_pence / 100).toFixed(2)}` : "",
      });
      return renderSavedReply(reply.body, values);
    });
    return { ok: true, data: { text } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function refundAction(ticketId: string, input: unknown): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role)) return { ok: false, error: "Your role is not allowed to refund." };
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the refund details.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const summary = await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      return refundBooking(db, staff, ticket, parsed.data);
    });
    revalidateTicket(ticketId);
    return { ok: true, message: summary };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function moveTargets(bookingId: string): Promise<SupportResult> {
  const staff = await requireStaff();
  try {
    const nights = await withStaff(staff, async (db) => {
      const [b] = await db<{ group_size: number; event_night_id: string }[]>`select group_size, event_night_id from crm.bookings where id = ${bookingId}`;
      if (!b) throw new Error("Booking not found");
      return listMoveTargets(db, b.group_size, b.event_night_id);
    });
    return { ok: true, data: { nights } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function moveAction(ticketId: string, input: unknown): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role) && staff.role !== "front_desk") return { ok: false, error: "Your role is not allowed to move bookings." };
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const summary = await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      return moveBooking(db, staff, ticket, parsed.data);
    });
    revalidateTicket(ticketId);
    return { ok: true, message: summary };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function resendAction(ticketId: string, bookingId: string): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role) && staff.role !== "front_desk") return { ok: false, error: "Your role is not allowed to resend tickets." };
  try {
    const summary = await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      return resendTickets(db, staff, ticket, bookingId);
    });
    revalidateTicket(ticketId);
    revalidatePath("/outbox");
    return { ok: true, message: summary };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function voucherAction(ticketId: string, input: unknown): Promise<SupportResult> {
  const staff = await requireStaff();
  if (!canManageSupport(staff.role)) return { ok: false, error: "Your role is not allowed to issue vouchers." };
  const parsed = voucherSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the voucher details.", fieldErrors: fieldErrors(parsed.error) };
  try {
    const r = await withStaff(staff, async (db) => {
      const ticket = await getTicket(db, ticketId);
      if (!ticket) throw new Error("Ticket not found");
      return issueVoucher(db, staff, ticket, parsed.data);
    });
    revalidateTicket(ticketId);
    revalidatePath("/outbox");
    return { ok: true, message: r.summary, data: { code: r.code } };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
