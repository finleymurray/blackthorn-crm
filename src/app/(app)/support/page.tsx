import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { InboxFrame, parseTicketParams, TicketListPanel, type RawSearch } from "@/components/support/inbox";
import { SimulateInboundButton } from "@/components/support/simulate-inbound-button";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<RawSearch> }) {
  const staff = await requireStaff("/support");
  const params = parseTicketParams(await searchParams);
  return (
    <InboxFrame showList list={<TicketListPanel staff={staff} params={params} />}>
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Inbox className="size-6 text-muted" aria-hidden />
        <div>
          <p className="text-sm font-medium">Select a ticket</p>
          <p className="mt-1 max-w-xs text-[13px] text-muted">Pick a conversation from the list, or simulate a new inbound email to demonstrate the flow from scratch.</p>
        </div>
        <SimulateInboundButton label="Simulate inbound email" />
      </div>
    </InboxFrame>
  );
}
