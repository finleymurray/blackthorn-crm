import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getGuestContext, getTicket, getTicketMessages } from "@/lib/data/tickets";
import { getSupportConfig } from "@/lib/data/support-config";
import { getBooking, getBookingRefunds, listBookingActivity, listNights } from "@/lib/data/bookings";
import { InboxFrame, parseTicketParams, TicketListPanel, type RawSearch } from "@/components/support/inbox";
import { Conversation } from "@/components/support/conversation";
import { ContextPanel } from "@/components/support/context-panel";
import { TicketWorkspace, type BookingView } from "@/components/support/ticket-workspace";
import { canManageSupport } from "@/lib/auth/types";
import { aiEnabled } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearch> }) {
  const staff = await requireStaff("/support");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const raw = await searchParams;
  const listParams = parseTicketParams(raw);
  const viewRaw = Array.isArray(raw.view) ? raw.view[0] : raw.view;
  const viewId = viewRaw && /^[0-9a-f-]{36}$/i.test(viewRaw) ? viewRaw : null;

  const data = await withStaff(staff, async (db) => {
    const ticket = await getTicket(db, id);
    if (!ticket) return null;
    const [messages, context, config] = await Promise.all([getTicketMessages(db, id), getGuestContext(db, ticket), getSupportConfig(db)]);
    let bookingView: BookingView | null = null;
    if (viewId) {
      const booking = await getBooking(db, viewId);
      if (booking) {
        const [nights, refunds, activity] = await Promise.all([listNights(db), getBookingRefunds(db, viewId), listBookingActivity(db, viewId)]);
        bookingView = { booking, nights, refunds, activity };
      }
    }
    return { ticket, messages, context, config, bookingView };
  });
  if (!data) notFound();
  const editable = canManageSupport(staff.role);
  const canAct = editable || staff.role === "front_desk";

  return (
    <InboxFrame
      showList={false}
      list={<TicketListPanel staff={staff} params={listParams} currentId={id} />}
      context={<ContextPanel ticket={data.ticket} context={data.context} canAct={canAct} canRefund={editable} />}
    >
      <TicketWorkspace
        ticketId={id}
        bookingView={data.bookingView}
        knownBookings={data.context.bookings.map((b) => ({ id: b.id, reference: b.reference }))}
        canEdit={canAct}
        canRefund={editable}
        conversation={
          <Conversation
            ticket={data.ticket}
            messages={data.messages}
            config={{
              categories: data.config.categories.filter((c) => c.active),
              savedReplies: data.config.savedReplies,
              staff: data.config.staff.filter((s) => s.active && (s.role === "admin" || s.role === "support")),
            }}
            context={data.context}
            staff={staff}
            editable={editable}
            canReply={canAct}
            ai={aiEnabled()}
          />
        }
      />
    </InboxFrame>
  );
}
