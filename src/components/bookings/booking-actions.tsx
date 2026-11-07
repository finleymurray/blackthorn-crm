"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PoundSterling, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { refundBookingDirect, resendBookingDirect } from "@/app/(app)/bookings/actions";
import { formatMoney, parseMoneyToPence } from "@/lib/format";
import { perPersonPence } from "@/lib/support/refunds";

interface Summary {
  id: string;
  reference: string;
  total_paid_pence: number;
  refunded_pence: number;
  group_size: number;
  status: string;
  guest_email: string;
}

export function BookingActions({ booking: b, canRefund }: { booking: Summary; canRefund: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [kind, setKind] = React.useState<"full" | "partial">("full");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [voidTickets, setVoidTickets] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const remaining = b.total_paid_pence - b.refunded_pence;
  const pence = kind === "full" ? remaining : parseMoneyToPence(amount);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => start(async () => { const r = await resendBookingDirect(b.id); toast(r.ok ? { kind: "success", title: r.message ?? "Sent" } : { kind: "error", title: r.error }); if (r.ok) router.refresh(); })}>
        <Send /> Resend tickets
      </Button>
      {canRefund ? (
        <Button type="button" variant="secondary" size="sm" disabled={remaining <= 0 || b.status === "refunded"} onClick={() => setOpen(true)}>
          <PoundSterling /> Refund
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Refund {b.reference}</DialogTitle>
            <DialogDescription>Simulated: no money moves, but the booking, the guest&apos;s lifetime spend and the history are updated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1 rounded-md bg-white/[0.04] p-1" role="radiogroup" aria-label="Refund type">
              {(["full", "partial"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex-1 rounded-[4px] py-1 text-sm ${kind === k ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground"}`}>
                  {k === "full" ? `Full (${formatMoney(remaining)})` : "Partial"}
                </button>
              ))}
            </div>
            {kind === "partial" ? (
              <Field id="rfd-amount" label="Amount (£)" help={`Up to ${formatMoney(remaining)}. One person is about ${formatMoney(perPersonPence(b.total_paid_pence, b.group_size))}.`}>
                <div className="flex gap-2">
                  <Input id="rfd-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="max-w-[10rem]" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAmount((perPersonPence(b.total_paid_pence, b.group_size) / 100).toFixed(2))}>One person</Button>
                </div>
              </Field>
            ) : null}
            <Field id="rfd-reason" label="Reason" required>
              <Textarea id="rfd-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={kind === "full" || voidTickets} disabled={kind === "full"} onChange={(e) => setVoidTickets(e.target.checked)} className="mt-0.5" />
              <span>
                Void the tickets
                <span className="block text-xs text-muted">{kind === "full" ? "A full refund always voids the tickets." : "The booking is marked refunded so the tickets will not scan, even though only part of the money is returned."}</span>
              </span>
            </label>
            {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" loading={pending} disabled={!pence || pence <= 0} onClick={() => start(async () => {
              const r = await refundBookingDirect(b.id, { kind, amount_pence: pence ?? undefined, void_tickets: kind === "full" || voidTickets, reason });
              if (!r.ok) { setError(r.error); return; }
              setOpen(false);
              toast({ kind: "success", title: "Refund recorded", description: r.message });
              router.refresh();
            })}>
              <PoundSterling /> Refund {pence ? formatMoney(pence) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
