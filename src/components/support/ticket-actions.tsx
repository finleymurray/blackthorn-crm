"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarArrowDown, Gift, PoundSterling, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { moveAction, moveTargets, refundAction, resendAction, voucherAction } from "@/app/(app)/support/actions";
import type { ContextBooking, NightOption, TicketDetail } from "@/lib/data/tickets";
import { formatDateOnly, formatMoney, parseMoneyToPence } from "@/lib/format";
import { perPersonPence } from "@/lib/support/refunds";

type Mode = null | "refund" | "move" | "resend" | "voucher";

export function TicketActions({ ticket, bookings, canRefund }: { ticket: TicketDetail; bookings: ContextBooking[]; canRefund: boolean }) {
  const [mode, setMode] = React.useState<Mode>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const refundable = bookings.filter((b) => b.status !== "refunded" && b.total_paid_pence - b.refunded_pence > 0);
  const movable = bookings.filter((b) => b.status !== "refunded" && b.status !== "no_show");
  const preferred = (list: ContextBooking[]) => list.find((b) => b.id === ticket.booking_id) ?? list[0];

  const done = (r: { ok: boolean; message?: string; error?: string }) => {
    if (!r.ok) {
      toast({ kind: "error", title: "Not done", description: r.error });
      return false;
    }
    toast({ kind: "success", title: "Done", description: r.message });
    setMode(null);
    router.refresh();
    return true;
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {canRefund ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setMode("refund")} disabled={refundable.length === 0} className="justify-start">
            <PoundSterling /> Refund
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={() => setMode("move")} disabled={movable.length === 0} className="justify-start">
          <CalendarArrowDown /> Move night
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setMode("resend")} disabled={bookings.length === 0} className="justify-start">
          <Send /> Resend tickets
        </Button>
        {canRefund ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setMode("voucher")} className="justify-start">
            <Gift /> Voucher
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">All actions are simulated, logged on the ticket and in the audit trail.</p>

      {mode === "refund" ? <RefundDialog ticket={ticket} bookings={refundable} initial={preferred(refundable)?.id ?? ""} onClose={() => setMode(null)} onResult={done} /> : null}
      {mode === "move" ? <MoveDialog ticket={ticket} bookings={movable} initial={preferred(movable)?.id ?? ""} onClose={() => setMode(null)} onResult={done} /> : null}
      {mode === "voucher" ? <VoucherDialog ticket={ticket} onClose={() => setMode(null)} onResult={done} /> : null}
      {mode === "resend" ? (
        <Dialog open onOpenChange={(o) => !o && setMode(null)}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Resend tickets</DialogTitle>
              <DialogDescription>Sends the booking confirmation again to {ticket.requester_email}.</DialogDescription>
            </DialogHeader>
            <ResendForm bookings={bookings} initial={preferred(bookings)?.id ?? ""} pending={pending} onSubmit={(bookingId) => start(async () => void done(await resendAction(ticket.id, bookingId)))} onCancel={() => setMode(null)} />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function BookingSelect({ id, bookings, value, onChange }: { id: string; bookings: ContextBooking[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {bookings.map((b) => (
        <option key={b.id} value={b.id}>
          {b.reference} · {formatDateOnly(b.date)} · {b.group_size} tickets · {formatMoney(b.total_paid_pence - b.refunded_pence)} refundable
        </option>
      ))}
    </Select>
  );
}

function ResendForm({ bookings, initial, pending, onSubmit, onCancel }: { bookings: ContextBooking[]; initial: string; pending: boolean; onSubmit: (id: string) => void; onCancel: () => void }) {
  const [bookingId, setBookingId] = React.useState(initial);
  return (
    <>
      <Field id="rs-booking" label="Booking">
        <BookingSelect id="rs-booking" bookings={bookings} value={bookingId} onChange={setBookingId} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onSubmit(bookingId)} loading={pending}>
          <Send /> Resend
        </Button>
      </DialogFooter>
    </>
  );
}

function RefundDialog({ ticket, bookings, initial, onClose, onResult }: { ticket: TicketDetail; bookings: ContextBooking[]; initial: string; onClose: () => void; onResult: (r: { ok: boolean; message?: string; error?: string }) => boolean }) {
  const [bookingId, setBookingId] = React.useState(initial);
  const [kind, setKind] = React.useState<"full" | "partial">("full");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [voidTickets, setVoidTickets] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const booking = bookings.find((b) => b.id === bookingId);
  const remaining = booking ? booking.total_paid_pence - booking.refunded_pence : 0;
  const pence = kind === "full" ? remaining : parseMoneyToPence(amount);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Refund a booking</DialogTitle>
          <DialogDescription>Simulated: no money moves, but the booking, the guest&apos;s lifetime spend and the audit trail are all updated as they would be.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="rf-booking" label="Booking">
            <BookingSelect id="rf-booking" bookings={bookings} value={bookingId} onChange={setBookingId} />
          </Field>
          <div className="flex gap-1 rounded-md bg-white/[0.04] p-1" role="radiogroup" aria-label="Refund type">
            {(["full", "partial"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`flex-1 rounded-[4px] py-1 text-sm ${kind === k ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground"}`}
              >
                {k === "full" ? `Full refund (${formatMoney(remaining)})` : "Partial refund"}
              </button>
            ))}
          </div>
          {kind === "partial" ? (
            <Field id="rf-amount" label="Amount" help={booking ? `Up to ${formatMoney(remaining)}. One person's share is about ${formatMoney(perPersonPence(booking.total_paid_pence, booking.group_size))}.` : undefined}>
              <div className="flex gap-2">
                <Input id="rf-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 28.00" inputMode="decimal" className="max-w-[10rem]" />
                {booking ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAmount((perPersonPence(booking.total_paid_pence, booking.group_size) / 100).toFixed(2))}>
                    One person
                  </Button>
                ) : null}
              </div>
            </Field>
          ) : null}
          <Field id="rf-reason" label="Reason" required>
            <Textarea id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Duplicate payment, bereavement, weather closure" maxLength={300} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={kind === "full" || voidTickets} disabled={kind === "full"} onChange={(e) => setVoidTickets(e.target.checked)} className="mt-0.5" />
            <span>
              Void the tickets
              <span className="block text-xs text-muted">{kind === "full" ? "A full refund always voids the tickets." : "Marks the booking as refunded so the tickets will not scan at the gate, even though only part of the money is returned."}</span>
            </span>
          </label>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={!booking || pence === null || pence <= 0}
            onClick={() =>
              start(async () => {
                const r = await refundAction(ticket.id, { booking_id: bookingId, kind, amount_pence: pence ?? undefined, void_tickets: kind === "full" || voidTickets, reason });
                if (!r.ok) setError(r.error);
                else onResult(r);
              })
            }
          >
            <PoundSterling /> Refund {pence ? formatMoney(pence) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ ticket, bookings, initial, onClose, onResult }: { ticket: TicketDetail; bookings: ContextBooking[]; initial: string; onClose: () => void; onResult: (r: { ok: boolean; message?: string; error?: string }) => boolean }) {
  const [bookingId, setBookingId] = React.useState(initial);
  const [nights, setNights] = React.useState<NightOption[] | null>(null);
  const [nightId, setNightId] = React.useState("");
  const [entryTime, setEntryTime] = React.useState("19:30");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [loadedFor, setLoadedFor] = React.useState(bookingId);
  if (loadedFor !== bookingId) {
    setLoadedFor(bookingId);
    setNights(null);
  }

  React.useEffect(() => {
    let cancelled = false;
    moveTargets(bookingId).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        const list = (r.data as { nights: NightOption[] }).nights;
        setNights(list);
        setNightId(list[0]?.id ?? "");
      } else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Move booking to another night</DialogTitle>
          <DialogDescription>Only nights with enough remaining capacity for the whole party are offered.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field id="mv-booking" label="Booking">
            <BookingSelect id="mv-booking" bookings={bookings} value={bookingId} onChange={setBookingId} />
          </Field>
          <Field id="mv-night" label="New night" help={nights ? `${nights.length} night${nights.length === 1 ? "" : "s"} with space` : "Checking capacity…"}>
            <Select id="mv-night" value={nightId} onChange={(e) => setNightId(e.target.value)} disabled={!nights || nights.length === 0}>
              {(nights ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {formatDateOnly(n.date)} · {n.capacity - n.booked} of {n.capacity} places left
                </option>
              ))}
              {nights && nights.length === 0 ? <option value="">No upcoming nights have space</option> : null}
            </Select>
          </Field>
          <Field id="mv-time" label="Entry time">
            <Select id="mv-time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)}>
              {["18:30", "18:45", "19:00", "19:15", "19:30", "19:45", "20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={!nightId}
            onClick={() =>
              start(async () => {
                const r = await moveAction(ticket.id, { booking_id: bookingId, night_id: nightId, entry_time: entryTime });
                if (!r.ok) setError(r.error);
                else onResult(r);
              })
            }
          >
            <CalendarArrowDown /> Move booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoucherDialog({ ticket, onClose, onResult }: { ticket: TicketDetail; onClose: () => void; onResult: (r: { ok: boolean; message?: string; error?: string }) => boolean }) {
  const [amount, setAmount] = React.useState("30.00");
  const [reason, setReason] = React.useState("");
  const [months, setMonths] = React.useState("12");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const pence = parseMoneyToPence(amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Issue a voucher</DialogTitle>
          <DialogDescription>Creates a voucher code and emails it to {ticket.requester_email} (demo outbox).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="vc-amount" label="Amount (£)" required>
              <Input id="vc-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field id="vc-months" label="Valid for">
              <Select id="vc-months" value={months} onChange={(e) => setMonths(e.target.value)}>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="24">24 months</option>
              </Select>
            </Field>
          </div>
          <Field id="vc-reason" label="Reason" required>
            <Textarea id="vc-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Goodwill for the queue times on 31/10" maxLength={300} />
          </Field>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            disabled={!pence}
            onClick={() =>
              start(async () => {
                const r = await voucherAction(ticket.id, { amount_pence: pence, reason, months_valid: Number(months) });
                if (!r.ok) setError(r.error);
                else onResult(r);
              })
            }
          >
            <Gift /> Issue {pence ? formatMoney(pence) : ""} voucher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
