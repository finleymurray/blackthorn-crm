import Link from "next/link";
import { Accessibility, Ban, ExternalLink, HandMetal } from "lucide-react";
import type { GuestContext, TicketDetail } from "@/lib/data/tickets";
import { formatDateOnly, formatDateTime, formatClock, formatMoney, formatPostcode } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { TICKET_TYPE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/domain/constants";
import { TicketActions } from "./ticket-actions";
import { OpenBookingLink } from "./open-booking-link";
import { titleCase } from "@/lib/utils";

const bookingTone: Record<string, "success" | "danger" | "info" | "warning"> = { confirmed: "success", refunded: "danger", transferred: "info", no_show: "warning" };
const ticketTone: Record<string, "accent" | "info" | "warning" | "success"> = { new: "accent", open: "info", waiting_on_guest: "warning", resolved: "success" };

/** Right hand panel: who the guest is, their bookings, flags and history, plus the action buttons. */
export function ContextPanel({ ticket, context, canAct, canRefund }: { ticket: TicketDetail; context: GuestContext; canAct: boolean; canRefund: boolean }) {
  const g = context.guest;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="border-b border-border p-5">
        {g ? (
          <>
            <div className="flex items-start gap-3">
              <Avatar name={`${g.first_name} ${g.last_name}`} size="lg" />
              <div className="min-w-0 flex-1">
                <Link href={`/guests/${g.id}`} className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                  {g.first_name} {g.last_name} <ExternalLink className="size-3 text-muted" aria-hidden />
                </Link>
                <p className="truncate text-xs text-muted">{g.email}</p>
                <p className="text-xs text-muted">
                  {g.phone ?? "No phone"}
                  {g.postcode ? ` · ${formatPostcode(g.postcode)}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {g.banned ? (
                <Badge variant="danger">
                  <Ban className="size-2.5" aria-hidden /> Banned
                </Badge>
              ) : null}
              {g.accessibility_needs ? (
                <Badge variant="info">
                  <Accessibility className="size-2.5" aria-hidden /> Accessibility
                </Badge>
              ) : null}
              {g.do_not_touch ? (
                <Badge variant="warning">
                  <HandMetal className="size-2.5" aria-hidden /> Do not touch
                </Badge>
              ) : null}
              {g.tags.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
            {g.accessibility_needs ? <p className="mt-2 rounded-md bg-info-soft px-2.5 py-1.5 text-xs leading-snug text-info">{g.accessibility_needs}</p> : null}
            {g.banned && g.banned_reason ? <p className="mt-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs leading-snug text-danger">{g.banned_reason}</p> : null}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
                <dt className="text-[11px] text-muted">Visits</dt>
                <dd className="tabular text-sm font-medium">{g.visit_count}</dd>
              </div>
              <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
                <dt className="text-[11px] text-muted">Spend</dt>
                <dd className="tabular text-sm font-medium">{formatMoney(g.lifetime_spend_pence, { compact: true })}</dd>
              </div>
              <div className="rounded-md bg-white/[0.04] px-2 py-1.5">
                <dt className="text-[11px] text-muted">Consent</dt>
                <dd className="text-xs font-medium">
                  {g.email_consent ? "Email" : ""}
                  {g.email_consent && g.sms_consent ? " + " : ""}
                  {g.sms_consent ? "SMS" : ""}
                  {!g.email_consent && !g.sms_consent ? <span className="text-muted">None</span> : null}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div>
            <p className="text-sm font-medium">{ticket.requester_name}</p>
            <p className="text-xs text-muted">{ticket.requester_email}</p>
            <p className="mt-2 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-muted">No guest record matches this email. The ticket is not linked to a guest.</p>
          </div>
        )}
      </div>

      {canAct && g ? (
        <div className="border-b border-border p-5">
          <h2 className="mb-3 text-xs font-medium text-muted">Actions</h2>
          <TicketActions ticket={ticket} bookings={context.bookings} canRefund={canRefund} />
        </div>
      ) : null}

      <section className="border-b border-border p-5">
        <h2 className="mb-3 text-xs font-medium text-muted">Bookings</h2>
        {context.bookings.length === 0 ? (
          <p className="text-[13px] text-muted">No bookings on file.</p>
        ) : (
          <ul className="space-y-3">
            {context.bookings.map((b) => (
              <li key={b.id} className={`rounded-md border px-3.5 py-3 text-[13px] ${b.id === ticket.booking_id ? "border-accent/50 bg-accent-soft/40" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <OpenBookingLink bookingId={b.id} className="font-mono text-xs hover:underline">
                    {b.reference}
                  </OpenBookingLink>
                  <Badge variant={bookingTone[b.status]} dot>
                    {BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status}
                  </Badge>
                </div>
                <p className="mt-1">
                  {formatDateOnly(b.date)} · {formatClock(b.entry_time)} · {b.group_size} × {TICKET_TYPE_LABELS[b.ticket_type as keyof typeof TICKET_TYPE_LABELS] ?? b.ticket_type}
                </p>
                <p className="text-muted">
                  Paid {formatMoney(b.total_paid_pence)}
                  {b.refunded_pence ? `, refunded ${formatMoney(b.refunded_pence)}` : ""}
                  {b.id === ticket.booking_id ? " · this ticket" : ""}
                </p>
                <OpenBookingLink bookingId={b.id} className="mt-1 inline-block text-xs text-muted hover:text-foreground">
                  Open in a tab
                </OpenBookingLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {context.vouchers.length ? (
        <section className="border-b border-border p-5">
          <h2 className="mb-3 text-xs font-medium text-muted">Vouchers</h2>
          <ul className="space-y-1 text-[13px]">
            {context.vouchers.map((v) => (
              <li key={v.code} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{v.code}</span>
                <span className="text-muted">
                  {formatMoney(v.amount_pence)} · {v.redeemed_at ? "used" : `until ${formatDateOnly(v.expires_on)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="p-5">
        <h2 className="mb-3 text-xs font-medium text-muted">Previous tickets</h2>
        {context.previousTickets.length === 0 ? (
          <p className="text-[13px] text-muted">First time this guest has contacted us.</p>
        ) : (
          <ul className="space-y-1.5">
            {context.previousTickets.map((t) => (
              <li key={t.id}>
                <Link href={`/support/${t.id}`} className="block rounded-md px-1 py-0.5 text-[13px] hover:bg-white/[0.04]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      <span className="text-muted">#{t.number}</span> {t.subject}
                    </span>
                    <Badge variant={ticketTone[t.status]} dot>
                      {t.status === "waiting_on_guest" ? "Waiting" : titleCase(t.status)}
                    </Badge>
                  </span>
                  <span className="block text-xs text-muted">
                    {titleCase(t.category)} · {formatDateTime(t.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {g?.notes ? (
          <div className="mt-4">
            <h2 className="mb-1 text-xs font-medium text-muted">Guest notes</h2>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-strong">{g.notes}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
