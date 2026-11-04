import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getGuestContext, getTicket, getTicketMessages } from "@/lib/data/tickets";
import { getSupportConfig } from "@/lib/data/support-config";
import { InboxFrame, parseTicketParams, TicketListPanel, type RawSearch } from "@/components/support/inbox";
import { Conversation } from "@/components/support/conversation";
import { ContextPanel } from "@/components/support/context-panel";
import { canManageSupport } from "@/lib/auth/types";
import { aiEnabled } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawSearch> }) {
  const staff = await requireStaff("/support");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const listParams = parseTicketParams(await searchParams);

  const data = await withStaff(staff, async (db) => {
    const ticket = await getTicket(db, id);
    if (!ticket) return null;
    const [messages, context, config] = await Promise.all([getTicketMessages(db, id), getGuestContext(db, ticket), getSupportConfig(db)]);
    return { ticket, messages, context, config };
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
      <Conversation
        ticket={data.ticket}
        messages={data.messages}
        config={{
          categories: data.config.categories.filter((c) => c.active),
          rootCauses: data.config.rootCauses.filter((r) => r.active),
          savedReplies: data.config.savedReplies,
          staff: data.config.staff.filter((s) => s.active && (s.role === "admin" || s.role === "support")),
        }}
        context={data.context}
        staff={staff}
        editable={editable}
        canReply={canAct}
        ai={aiEnabled()}
      />
    </InboxFrame>
  );
}
