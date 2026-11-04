import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Accessibility, Ban, Mail, Megaphone, Star } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getBooking, getBookingMessages, getBookingRefunds, getBookingTickets, listBookingActivity, listNights } from "@/lib/data/bookings";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BookingEditor } from "@/components/bookings/booking-editor";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BOOKING_STATUS_LABELS } from "@/lib/domain/constants";
import { titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking" };

const tone: Record<string, "success" | "danger" | "info" | "warning"> = { confirmed: "success", refunded: "danger", transferred: "info", no_show: "warning" };
const ticketTone: Record<string, "accent" | "info" | "warning" | "success"> = { new: "accent", open: "info", waiting_on_guest: "warning", resolved: "success" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("/bookings");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withStaff(staff, async (db) => {
    const booking = await getBooking(db, id);
    if (!booking) return null;
    const [refunds, tickets, messages, activity, nights] = await Promise.all([getBookingRefunds(db, id), getBookingTickets(db, id), getBookingMessages(db, booking.reference, booking.guest_id), listBookingActivity(db, id), listNights(db)]);
    return { booking, refunds, tickets, messages, activity, nights };
  });
  if (!data) notFound();
  const { booking: b } = data;
  const canEdit = staff.role === "admin" || staff.role === "support" || staff.role === "front_desk";
  const canRefund = staff.role === "admin" || staff.role === "support";
  const remaining = b.total_paid_pence - b.refunded_pence;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Bookings", href: "/bookings" }]}
        title={b.reference}
        meta={`${BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status} · booked ${formatDateTime(b.booked_at)}`}
        actions={canEdit ? <BookingActions booking={{ id: b.id, reference: b.reference, total_paid_pence: b.total_paid_pence, refunded_pence: b.refunded_pence, group_size: b.group_size, status: b.status, guest_email: b.guest_email }} canRefund={canRefund} /> : null}
      />
      <PageBody wide className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section aria-label="Summary" className="stat-strip grid-cols-2 md:grid-cols-4">
            <div>
              <p className="stat-label">Status</p>
              <p className="stat-value text-base"><Badge variant={tone[b.status]} dot>{BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status}</Badge></p>
              <p className="stat-sub">{b.is_future ? "upcoming visit" : "visit has passed"}</p>
            </div>
            <div>
              <p className="stat-label">Paid</p>
              <p className="stat-value">{formatMoney(b.total_paid_pence)}</p>
              <p className="stat-sub">{b.refunded_pence ? `${formatMoney(b.refunded_pence)} refunded, ${formatMoney(remaining)} remaining` : "nothing refunded"}</p>
            </div>
            <div>
              <p className="stat-label">Party</p>
              <p className="stat-value">{b.group_size}</p>
              <p className="stat-sub">{titleCase(b.ticket_type)} tickets</p>
            </div>
            <div>
              <p className="stat-label">Survey</p>
              <p className="stat-value">{b.survey_score ?? "–"}</p>
              <p className="stat-sub">{b.survey_score ? "out of 10" : "not completed"}</p>
            </div>
          </section>

          <BookingEditor key={String(b.updated_at)} booking={b} nights={data.nights} editable={canEdit} />

          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">History</h2><span className="panel-meta">Every change to this booking</span></div>
            {data.refunds.length === 0 && data.activity.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted">No changes since the booking was made.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.refunds.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <div>
                      <span className="font-medium">Refund of {formatMoney(r.amount_pence)}</span>
                      <span className="text-muted"> · {r.reason}</span>
                      {r.ticket_id ? <Link href={`/support/${r.ticket_id}`} className="ml-2 text-xs text-muted hover:text-foreground">ticket #{r.ticket_number}</Link> : null}
                      <div className="text-[11px] text-muted">{r.processed_by_name ?? "System"} · ref {r.provider_reference}</div>
                    </div>
                    <span className="shrink-0 tabular text-[11px] text-muted">{formatDateTime(r.created_at)}</span>
                  </li>
                ))}
                {data.activity.filter((a) => a.action !== "booking.refunded").map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <div>
                      {a.summary}
                      <div className="text-[11px] text-muted">{a.staff_name ?? "System"}</div>
                    </div>
                    <span className="shrink-0 tabular text-[11px] text-muted">{formatDateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel p-4">
            <div className="flex items-start gap-3">
              <Avatar name={b.guest_name} size="lg" />
              <div className="min-w-0">
                <Link href={`/guests/${b.guest_id}`} className="text-[13px] font-medium hover:underline">{b.guest_name}</Link>
                <p className="truncate text-[11px] text-muted">{b.guest_email}</p>
                <p className="text-[11px] text-muted">{b.guest_phone ?? "No phone"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {b.guest_banned ? <Badge variant="danger"><Ban className="size-2.5" aria-hidden /> Banned</Badge> : null}
              {b.guest_accessibility ? <Badge variant="info"><Accessibility className="size-2.5" aria-hidden /> Accessibility</Badge> : null}
            </div>
            {b.guest_accessibility ? <p className="mt-2 rounded-md bg-info-soft px-2.5 py-1.5 text-[11px] leading-snug text-info">{b.guest_accessibility}</p> : null}
            <div className="mt-3">
              <Button asChild variant="secondary" size="sm" className="w-full"><Link href={`/support/new?guest=${b.guest_id}`}>Raise a ticket</Link></Button>
            </div>
          </section>

          {b.source_campaign_id ? (
            <section className="panel p-4 text-xs">
              <p className="flex items-center gap-1.5 text-muted"><Megaphone className="size-3.5" aria-hidden /> Attributed to campaign</p>
              <Link href={`/campaigns/${b.source_campaign_id}/report`} className="mt-1 block text-[13px] hover:underline">{b.source_campaign_name}</Link>
            </section>
          ) : null}

          {b.survey_score ? (
            <section className="panel p-4 text-xs">
              <p className="flex items-center gap-1.5 text-muted"><Star className="size-3.5" aria-hidden /> Survey {b.survey_score}/10</p>
              {b.survey_comments ? <p className="mt-1 text-[13px] leading-relaxed text-muted-strong">“{b.survey_comments}”</p> : null}
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Support tickets</h2></div>
            {data.tickets.length === 0 ? <p className="px-4 py-4 text-xs text-muted">None linked to this booking.</p> : (
              <ul className="divide-y divide-border">
                {data.tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/support/${t.id}`} className="flex items-center justify-between gap-2 px-4 py-2 text-xs hover:bg-white/[0.03]">
                      <span className="truncate"><span className="text-muted">#{t.number}</span> {t.subject}</span>
                      <Badge variant={ticketTone[t.status]} dot>{t.status === "waiting_on_guest" ? "Waiting" : titleCase(t.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">Messages about this booking</h2></div>
            {data.messages.length === 0 ? <p className="px-4 py-4 text-xs text-muted">Nothing sent yet.</p> : (
              <ul className="divide-y divide-border">
                {data.messages.map((m) => (
                  <li key={m.id}>
                    <Link href={`/outbox/${m.id}`} className="flex items-start gap-2 px-4 py-2 text-xs hover:bg-white/[0.03]">
                      <Mail className="mt-0.5 size-3 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{m.subject ?? "Text message"}</span>
                        <span className="block text-[11px] text-muted">{formatDateTime(m.sent_at)}{m.opened_at ? " · opened" : ""}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </PageBody>
    </>
  );
}
