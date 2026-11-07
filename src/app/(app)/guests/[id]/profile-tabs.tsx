"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, CalendarDays, LifeBuoy, Mail, MessageSquare, Star, Ticket, UserPen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateOnly, formatDateTime, formatMoney, formatClock } from "@/lib/format";
import { ADDON_LABELS, BOOKING_STATUS_LABELS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, TICKET_TYPE_LABELS } from "@/lib/domain/constants";
import type { GuestBooking, GuestMessage, GuestTicket, TimelineEvent } from "@/lib/data/guests";
import { cn, titleCase } from "@/lib/utils";

const bookingBadge: Record<string, "success" | "danger" | "info" | "warning"> = {
  confirmed: "success",
  refunded: "danger",
  transferred: "info",
  no_show: "warning",
};
const ticketBadge: Record<string, "accent" | "info" | "warning" | "success"> = {
  new: "accent",
  open: "info",
  waiting_on_guest: "warning",
  resolved: "success",
};

export function GuestProfileTabs({
  initialTab,
  bookings,
  timeline,
  tickets,
  messages,
}: {
  guestId: string;
  initialTab?: string;
  bookings: GuestBooking[];
  timeline: TimelineEvent[];
  tickets: GuestTicket[];
  messages: GuestMessage[];
}) {
  const valid = ["timeline", "bookings", "support", "marketing"];
  const [tab, setTab] = React.useState(initialTab && valid.includes(initialTab) ? initialTab : "timeline");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Guest sections" className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
        <TabsTrigger value="support">Support ({tickets.length})</TabsTrigger>
        <TabsTrigger value="marketing">Marketing ({messages.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="timeline">
        <Timeline events={timeline} />
      </TabsContent>

      <TabsContent value="bookings">
        {bookings.length === 0 ? (
          <EmptyState icon={Ticket} title="No bookings yet" description="Bookings made through the website will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Night</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead className="hidden md:table-cell">Add-ons</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Survey</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/bookings/${b.id}`} className="font-mono text-[13px] hover:underline">
                      {b.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDateOnly(b.date)}</div>
                    <div className="text-[13px] text-muted">{formatClock(b.entry_time)} entry · {b.season_year}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {b.group_size} × {TICKET_TYPE_LABELS[b.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? titleCase(b.ticket_type)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[13px] text-muted">{b.addons.length ? b.addons.map((a) => ADDON_LABELS[a] ?? a).join(", ") : "–"}</TableCell>
                  <TableCell className="tabular text-right text-sm">
                    {formatMoney(b.total_paid_pence)}
                    {b.refunded_pence > 0 ? <div className="text-[13px] text-danger">−{formatMoney(b.refunded_pence)}</div> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={bookingBadge[b.status] ?? "default"} dot>{BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[13px] text-muted">{b.survey_score ? `${b.survey_score}/10` : "Not completed"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="support">
        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No support tickets" description="This guest has never contacted support." />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{t.number} {t.subject}
                    </p>
                    <p className="text-[13px] text-muted">
                      {titleCase(t.category)} · {TICKET_PRIORITY_LABELS[t.priority as keyof typeof TICKET_PRIORITY_LABELS]} priority · {formatDateTime(t.created_at)}
                    </p>
                  </div>
                  <Badge variant={ticketBadge[t.status] ?? "default"} dot>{TICKET_STATUS_LABELS[t.status as keyof typeof TICKET_STATUS_LABELS]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="marketing">
        {messages.length === 0 ? (
          <EmptyState icon={Mail} title="No messages sent" description="Campaign and automation messages to this guest will show here." />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {messages.map((m) => (
              <li key={m.id}>
                <Link href={`/outbox/${m.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring">
                  {m.channel === "sms" ? <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> : <Mail className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.subject ?? m.body_text.slice(0, 80)}</p>
                    <p className="text-[13px] text-muted">
                      {m.campaign_name ? `Campaign: ${m.campaign_name}` : m.automation_name ? `Automation: ${m.automation_name}` : m.ticket_number ? `Ticket #${m.ticket_number}` : "Manual"} · {formatDateTime(m.sent_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {m.status === "test" ? <Badge>Test</Badge> : null}
                    {m.opened_at ? <Badge variant="success">Opened</Badge> : <Badge>Unopened</Badge>}
                    {m.clicked_at ? <Badge variant="info">Clicked</Badge> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

const iconFor: Record<TimelineEvent["kind"], React.ComponentType<{ className?: string }>> = {
  booking: Ticket,
  survey: Star,
  message: Mail,
  ticket: LifeBuoy,
  note: UserPen,
  activity: Activity,
};

function Timeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = React.useState<"all" | TimelineEvent["kind"]>("all");
  const kinds: Array<{ key: "all" | TimelineEvent["kind"]; label: string }> = [
    { key: "all", label: "Everything" },
    { key: "booking", label: "Bookings" },
    { key: "survey", label: "Surveys" },
    { key: "message", label: "Messages" },
    { key: "ticket", label: "Support" },
    { key: "activity", label: "Staff activity" },
  ];
  const shown = filter === "all" ? events : events.filter((e) => e.kind === filter);

  if (events.length === 0) {
    return <EmptyState icon={CalendarDays} title="Nothing has happened yet" description="Bookings, surveys, messages and support will appear here in date order." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Filter timeline">
        {kinds.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setFilter(k.key)}
            aria-pressed={filter === k.key}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              filter === k.key ? "border-white/[0.16] bg-white/[0.08] text-foreground" : "border-white/[0.08] text-white/60 hover:border-white/[0.16] hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <ol className="relative space-y-0 border-l border-border pl-5">
        {shown.map((e) => {
          const Icon = iconFor[e.kind];
          const tone =
            e.kind === "survey" && Number(e.meta.score) <= 4
                ? "bg-danger-soft text-danger"
                : e.kind === "ticket"
                  ? "bg-info-soft text-info"
                  : "bg-surface-raised text-muted-strong";
          const body = (
            <>
              <p className="text-sm font-medium leading-snug">{e.title}</p>
              {e.detail ? <p className="mt-0.5 text-[13px] text-muted">{e.detail}</p> : null}
              {e.kind === "message" ? (
                <p className="mt-1 flex gap-1">
                  <Badge className="text-[11px]">{String(e.meta.channel).toUpperCase()}</Badge>
                  {e.meta.opened ? <Badge variant="success" className="text-[11px]">Opened</Badge> : null}
                  {e.meta.clicked ? <Badge variant="info" className="text-[11px]">Clicked</Badge> : null}
                </p>
              ) : null}
            </>
          );
          return (
            <li key={`${e.kind}-${e.id}`} className="relative pb-5">
              <span className={cn("absolute -left-[1.6rem] top-0 flex size-6 items-center justify-center rounded-full border border-border", tone)} aria-hidden>
                <Icon className="size-3" />
              </span>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {e.href ? (
                    <Link href={e.href} className="block rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </div>
                <time dateTime={new Date(e.at).toISOString()} className="shrink-0 text-[13px] text-muted sm:text-right" title={formatDateTime(e.at)}>
                  {formatDateTime(e.at)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
      {shown.length === 0 ? <p className="text-sm text-muted">No events of that type.</p> : null}
    </div>
  );
}
