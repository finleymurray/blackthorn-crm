import Link from "next/link";
import { Inbox as InboxIcon, Plus, Zap } from "lucide-react";
import type { StaffUser } from "@/lib/auth/types";
import { withStaff } from "@/lib/db/client";
import { listTickets, ticketListParamsSchema, type TicketListParams, type TicketListRow } from "@/lib/data/tickets";
import { getSupportConfig } from "@/lib/data/support-config";
import { formatRelative } from "@/lib/format";
import { TICKET_PRIORITY_LABELS } from "@/lib/domain/constants";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { TicketFilters } from "./ticket-filters";
import { SlaTimer } from "./sla-timer";
import { SimulateInboundButton } from "./simulate-inbound-button";
import { cn, titleCase } from "@/lib/utils";

export type RawSearch = Record<string, string | string[] | undefined>;

export function parseTicketParams(raw: RawSearch): TicketListParams {
  const parsed = ticketListParamsSchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  return parsed.success ? parsed.data : ticketListParamsSchema.parse({});
}

export function paramsToQuery(p: TicketListParams): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.status !== "unresolved") sp.set("status", p.status);
  if (p.category) sp.set("category", p.category);
  if (p.priority) sp.set("priority", p.priority);
  if (p.mine) sp.set("mine", "1");
  if (p.overdue) sp.set("overdue", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const statusDot: Record<string, string> = { new: "bg-accent-text", open: "bg-info", waiting_on_guest: "bg-warning", resolved: "bg-success" };

/** The left panel: filters plus the ticket list. Server rendered. */
export async function TicketListPanel({ staff, params, currentId }: { staff: StaffUser; params: TicketListParams; currentId?: string }) {
  const { rows, total, counts, categories } = await withStaff(staff, async (db) => {
    const [list, config] = await Promise.all([listTickets(db, params, staff.id), getSupportConfig(db)]);
    return { ...list, categories: config.categories.filter((c) => c.active) };
  });
  const query = paramsToQuery(params);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
        <h1 className="text-sm font-medium">
          Support <span className="ml-1 text-[13px] text-muted">{total}</span>
        </h1>
        <div className="flex items-center gap-1">
          <SimulateInboundButton />
          <Button asChild variant="ghost" size="icon-sm" aria-label="New ticket">
            <Link href="/support/new">
              <Plus />
            </Link>
          </Button>
        </div>
      </div>
      <TicketFilters params={params} counts={counts} categories={categories} currentId={currentId} />
      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Tickets">
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-[13px] text-muted">
            <InboxIcon className="mx-auto mb-2 size-5" aria-hidden />
            No tickets match. Try another view, or <Zap className="inline size-3" aria-hidden /> simulate an inbound email.
          </li>
        ) : (
          rows.map((t) => <TicketListItem key={t.id} t={t} active={t.id === currentId} query={query} />)
        )}
      </ul>
    </div>
  );
}

function TicketListItem({ t, active, query }: { t: TicketListRow; active: boolean; query: string }) {
  const unread = t.status === "new" || t.last_direction === "inbound";
  return (
    <li>
      <Link
        href={`/support/${t.id}${query}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "block border-b border-border-subtle px-5 py-4 transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          active && "bg-white/[0.05]",
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar name={t.requester_name} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate text-sm", unread ? "font-medium text-foreground" : "text-muted-strong")}>{t.requester_name}</span>
              <span className="shrink-0 text-xs tabular text-muted">{formatRelative(t.last_message_at)}</span>
            </div>
            <p className={cn("mt-0.5 truncate text-sm", unread ? "text-foreground" : "text-muted-strong")}>
              <span className="text-muted">#{t.number}</span> {t.subject}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-muted">
              <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[t.status])} aria-hidden />
              <span className="truncate">
                {t.status === "waiting_on_guest" ? "Waiting" : titleCase(t.status)} · {titleCase(t.category)}
                {t.priority === "urgent" || t.priority === "high" ? (
                  <span className={t.priority === "urgent" ? "text-danger" : "text-warning"}> · {TICKET_PRIORITY_LABELS[t.priority]}</span>
                ) : null}
              </span>
              <span className="ml-auto shrink-0">
                <SlaTimer dueAt={t.sla_due_at} createdAt={t.created_at} resolvedAt={t.resolved_at} compact />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

/** Three panel frame: list | conversation | context. Collapses sensibly on small screens. */
export function InboxFrame({ list, children, context, showList }: { list: React.ReactNode; children: React.ReactNode; context?: React.ReactNode; showList: boolean }) {
  return (
    <div className="flex h-full min-h-0">
      <aside className={cn("w-full shrink-0 border-r border-border lg:w-[360px] 2xl:w-[380px]", showList ? "block" : "hidden lg:block")}>{list}</aside>
      <div className={cn("min-w-0 flex-1 flex-col", showList ? "hidden lg:flex" : "flex")}>{children}</div>
      {context ? <aside className="hidden w-[310px] shrink-0 border-l border-border xl:block 2xl:w-[340px]">{context}</aside> : null}
    </div>
  );
}
