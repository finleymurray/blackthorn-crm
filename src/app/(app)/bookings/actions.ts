"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { withStaff, isPermissionError } from "@/lib/db/client";
import { bookingEditSchema, getBooking, updateBooking } from "@/lib/data/bookings";
import { planRefund, RefundError } from "@/lib/support/refunds";
import { processRefund } from "@/lib/payments/provider";
import { logActivity } from "@/lib/data/activity";
import { sendEmail } from "@/lib/messaging/provider";
import { renderPlainEmailHtml } from "@/lib/messaging/email-blocks";
import { brandingFrom, getParkSettings } from "@/lib/data/settings";
import { formatClock, formatDateOnly, formatMoney } from "@/lib/format";
import { TICKET_TYPE_LABELS } from "@/lib/domain/constants";
import { errorMessage } from "@/lib/utils";
import { z } from "zod";

export type BookingResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const canEdit = (role: string) => role === "admin" || role === "support" || role === "front_desk";
const canRefund = (role: string) => role === "admin" || role === "support";

function friendly(err: unknown) {
  if (isPermissionError(err)) return "Your role is not allowed to change bookings.";
  if (err instanceof RefundError) return err.message;
  return errorMessage(err);
}

function revalidate(id: string, guestId?: string) {
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
  if (guestId) revalidatePath(`/guests/${guestId}`);
}

export async function saveBooking(id: string, input: unknown): Promise<BookingResult> {
  const staff = await requireStaff();
  if (!canEdit(staff.role)) return { ok: false, error: "Your role is not allowed to change bookings." };
  const parsed = bookingEditSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  try {
    const { changes, guestId } = await withStaff(staff, async (db) => {
      const b = await getBooking(db, id);
      if (!b) throw new Error("Booking not found");
      return { changes: await updateBooking(db, staff, id, parsed.data), guestId: b.guest_id };
    });
    revalidate(id, guestId);
    return { ok: true, message: changes.length ? `Saved: ${changes.join(", ")}` : "Saved (no changes)" };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

const refundInput = z.object({ kind: z.enum(["full", "partial"]), amount_pence: z.coerce.number().int().optional(), reason: z.string().trim().min(3, "Give a reason").max(300) });

export async function refundBookingDirect(id: string, input: unknown): Promise<BookingResult> {
  const staff = await requireStaff();
  if (!canRefund(staff.role)) return { ok: false, error: "Only admin and support can refund." };
  const parsed = refundInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the refund details." };
  try {
    const { summary, guestId } = await withStaff(staff, async (db) => {
      const [booking] = await db<{ id: string; reference: string; total_paid_pence: number; refunded_pence: number; status: string; guest_id: string }[]>`
        select id, reference, total_paid_pence, refunded_pence, status::text as status, guest_id from crm.bookings where id = ${id} for update`;
      if (!booking) throw new Error("Booking not found");
      const plan = planRefund(booking, { kind: parsed.data.kind, amount_pence: parsed.data.amount_pence });
      const receipt = await processRefund({ bookingReference: booking.reference, amountPence: plan.amount_pence, reason: parsed.data.reason });
      await db`insert into crm.refunds (booking_id, amount_pence, reason, processed_by, provider_reference) values (${booking.id}, ${plan.amount_pence}, ${parsed.data.reason}, ${staff.id}, ${receipt.providerReference})`;
      await db`update crm.bookings set refunded_pence = ${plan.new_refunded_pence}, status = ${plan.new_status}::booking_status where id = ${booking.id}`;
      await db`update crm.guests set lifetime_spend_pence = greatest(0, lifetime_spend_pence - ${plan.amount_pence}) where id = ${booking.guest_id}`;
      const summary = `Refunded ${formatMoney(plan.amount_pence)} on ${booking.reference} (${parsed.data.kind}${plan.new_status === "refunded" ? ", now fully refunded" : ""}). Simulated provider ref ${receipt.providerReference}. Reason: ${parsed.data.reason}`;
      await logActivity(db, staff, { action: "booking.refunded", entityType: "booking", entityId: booking.id, summary, details: { ...plan, provider_reference: receipt.providerReference } });
      await logActivity(db, staff, { action: "guest.booking_refunded", entityType: "guest", entityId: booking.guest_id, summary, details: { booking_id: booking.id } });
      return { summary, guestId: booking.guest_id };
    });
    revalidate(id, guestId);
    return { ok: true, message: summary };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}

export async function resendBookingDirect(id: string): Promise<BookingResult> {
  const staff = await requireStaff();
  if (!canEdit(staff.role)) return { ok: false, error: "Your role is not allowed to resend tickets." };
  try {
    const guestId = await withStaff(staff, async (db) => {
      const b = await getBooking(db, id);
      if (!b) throw new Error("Booking not found");
      const settings = await getParkSettings(db);
      const first = b.guest_name.split(" ")[0];
      const text = `Hi ${first},\n\nHere are your tickets again.\n\nBooking reference: ${b.reference}\nDate: ${formatDateOnly(b.date)}\nEntry time: ${formatClock(b.entry_time)}\nTickets: ${b.group_size} x ${TICKET_TYPE_LABELS[b.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? b.ticket_type}\n\nShow this email at the box office. See you in the dark.\n\n${settings.name}`;
      await sendEmail(db, { guestId: b.guest_id, to: b.guest_email, toName: b.guest_name, subject: `Your tickets for ${settings.name}: ${b.reference}`, html: renderPlainEmailHtml(text, brandingFrom(settings)), text });
      await logActivity(db, staff, { action: "booking.tickets_resent", entityType: "booking", entityId: id, summary: `Resent tickets for ${b.reference} to ${b.guest_email}` });
      return b.guest_id;
    });
    revalidate(id, guestId);
    revalidatePath("/outbox");
    return { ok: true, message: "Tickets resent to the outbox." };
  } catch (err) {
    return { ok: false, error: friendly(err) };
  }
}
