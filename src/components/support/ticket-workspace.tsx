"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, MessageSquareText, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingEditor } from "@/components/bookings/booking-editor";
import { BookingActions } from "@/components/bookings/booking-actions";
import type { BookingDetail, NightSummary } from "@/lib/data/bookings";
import { formatDateTime, formatMoney } from "@/lib/format";
import { BOOKING_STATUS_LABELS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

export interface BookingTab {
  id: string;
  reference: string;
}

export interface BookingView {
  booking: BookingDetail;
  nights: NightSummary[];
  refunds: Array<{ id: string; amount_pence: number; reason: string; processed_by_name: string | null; created_at: Date }>;
  activity: Array<{ id: number; staff_name: string | null; summary: string; created_at: Date }>;
}

const tone: Record<string, "success" | "danger" | "info" | "warning"> = { confirmed: "success", refunded: "danger", transferred: "info", no_show: "warning" };

/**
 * Tabbed centre panel for a ticket. The conversation is always mounted so
 * a half written reply survives switching to a booking and back. Which
 * booking is open is in the URL (?view=<booking id>) so the server can load
 * it; the list of open tabs is remembered per ticket in sessionStorage.
 */
export function TicketWorkspace({
  ticketId,
  conversation,
  bookingView,
  knownBookings,
  canEdit,
  canRefund,
}: {
  ticketId: string;
  conversation: React.ReactNode;
  bookingView: BookingView | null;
  knownBookings: BookingTab[];
  canEdit: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const activeId = search.get("view");
  const storageKey = `bt-ticket-tabs:${ticketId}`;
  const [tabs, setTabs] = React.useState<BookingTab[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Restore remembered tabs once, then keep the active booking in the list.
  React.useEffect(() => {
    let stored: BookingTab[] = [];
    try {
      stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]") as BookingTab[];
    } catch {
      stored = [];
    }
    const active = bookingView ? { id: bookingView.booking.id, reference: bookingView.booking.reference } : null;
    const next = active && !stored.some((t) => t.id === active.id) ? [...stored, active] : stored;
    // Defer to the next tick so this is not a synchronous setState inside the effect body.
    const t = window.setTimeout(() => {
      setTabs(next);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [storageKey, bookingView]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(tabs));
    } catch {
      /* ignore */
    }
  }, [tabs, hydrated, storageKey]);

  const withView = (id: string | null) => {
    const sp = new URLSearchParams(search.toString());
    if (id) sp.set("view", id);
    else sp.delete("view");
    return `${pathname}${sp.size ? `?${sp}` : ""}`;
  };

  const close = (id: string) => {
    setTabs((cur) => cur.filter((t) => t.id !== id));
    if (activeId === id) router.push(withView(null));
  };

  const allTabs = tabs.length ? tabs : knownBookings.filter((b) => b.id === activeId);
  const tabClass = (active: boolean) =>
    cn(
      "group inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
      active ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground",
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Ticket workspace" className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border px-2">
        <Link role="tab" aria-selected={!activeId} href={withView(null)} className={tabClass(!activeId)}>
          <MessageSquareText className="size-3.5" aria-hidden /> Conversation
        </Link>
        {allTabs.map((t) => {
          const active = t.id === activeId;
          return (
            <span key={t.id} className="flex items-end">
              <Link role="tab" aria-selected={active} href={withView(t.id)} className={tabClass(active)}>
                <Ticket className="size-3.5" aria-hidden />
                <span className="font-mono text-[13px]">{t.reference}</span>
              </Link>
              <button
                type="button"
                onClick={() => close(t.id)}
                aria-label={`Close ${t.reference}`}
                className="-ml-1 mb-2 rounded-sm p-0.5 text-muted hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
      </div>

      <div className={cn("min-h-0 flex-1 flex-col", activeId ? "hidden" : "flex")} hidden={!!activeId}>
        {conversation}
      </div>

      {activeId ? (
        bookingView && bookingView.booking.id === activeId ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <BookingPane view={bookingView} canEdit={canEdit} canRefund={canRefund} />
          </div>
        ) : (
          <p className="p-6 text-[13px] text-muted">Loading booking…</p>
        )
      ) : null}
    </div>
  );
}

function BookingPane({ view, canEdit, canRefund }: { view: BookingView; canEdit: boolean; canRefund: boolean }) {
  const b = view.booking;
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <span className="font-mono">{b.reference}</span>
            <Badge variant={tone[b.status]} dot>
              {BOOKING_STATUS_LABELS[b.status as keyof typeof BOOKING_STATUS_LABELS] ?? b.status}
            </Badge>
          </h2>
          <p className="text-xs text-muted">
            {b.guest_name} · booked {formatDateTime(b.booked_at)} · paid {formatMoney(b.total_paid_pence)}
            {b.refunded_pence ? `, ${formatMoney(b.refunded_pence)} refunded` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <BookingActions booking={{ id: b.id, reference: b.reference, total_paid_pence: b.total_paid_pence, refunded_pence: b.refunded_pence, group_size: b.group_size, status: b.status, guest_email: b.guest_email }} canRefund={canRefund} />
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/bookings/${b.id}`}>
              <ExternalLink /> Open full page
            </Link>
          </Button>
        </div>
      </div>
      <BookingEditor key={String(b.updated_at)} booking={b} nights={view.nights} editable={canEdit} />
      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">History</h3>
        </div>
        {view.refunds.length === 0 && view.activity.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted">No changes since the booking was made.</p>
        ) : (
          <ul className="divide-y divide-border">
            {view.refunds.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2 text-[13px]">
                <span>
                  Refund of {formatMoney(r.amount_pence)} · {r.reason}
                  <span className="block text-xs text-muted">{r.processed_by_name ?? "System"}</span>
                </span>
                <span className="shrink-0 tabular text-xs text-muted">{formatDateTime(r.created_at)}</span>
              </li>
            ))}
            {view.activity
              .filter((a) => !a.summary.startsWith("Refunded"))
              .map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2 text-[13px]">
                  <span>
                    {a.summary}
                    <span className="block text-xs text-muted">{a.staff_name ?? "System"}</span>
                  </span>
                  <span className="shrink-0 tabular text-xs text-muted">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
