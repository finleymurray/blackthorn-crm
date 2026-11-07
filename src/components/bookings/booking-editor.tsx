"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveBooking } from "@/app/(app)/bookings/actions";
import type { BookingDetail, NightSummary } from "@/lib/data/bookings";
import { ADDONS, TICKET_TYPE_LABELS } from "@/lib/domain/constants";
import { formatDateOnly, formatMoney, parseMoneyToPence } from "@/lib/format";

const SLOTS = ["18:30", "18:45", "19:00", "19:15", "19:30", "19:45", "20:00", "20:15", "20:30", "20:45", "21:00", "21:15", "21:30"];

export function BookingEditor({ booking: b, nights, editable }: { booking: BookingDetail; nights: NightSummary[]; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [nightId, setNightId] = React.useState(b.event_night_id);
  const [entryTime, setEntryTime] = React.useState(b.entry_time.slice(0, 5));
  const [ticketType, setTicketType] = React.useState(b.ticket_type);
  const [groupSize, setGroupSize] = React.useState(String(b.group_size));
  const [addons, setAddons] = React.useState<string[]>(b.addons);
  const [paid, setPaid] = React.useState((b.total_paid_pence / 100).toFixed(2));
  const [status, setStatus] = React.useState(b.status);
  const [note, setNote] = React.useState("");

  const snapshot = JSON.stringify({ nightId, entryTime, ticketType, groupSize, addons, paid, status });
  const [saved, setSaved] = React.useState(snapshot);
  const dirty = snapshot !== saved;
  const night = nights.find((n) => n.id === nightId);
  const spare = night ? night.capacity - night.booked + (night.id === b.event_night_id ? b.group_size : 0) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pence = parseMoneyToPence(paid);
    if (pence === null) {
      setErrors({ total_paid_pence: "Enter an amount like 84.00" });
      return;
    }
    start(async () => {
      const r = await saveBooking(b.id, { event_night_id: nightId, entry_time: entryTime, ticket_type: ticketType, group_size: Number(groupSize), addons, total_paid_pence: pence, status, note });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error);
        return;
      }
      setErrors({});
      setFormError(null);
      setSaved(snapshot);
      setNote("");
      toast({ kind: "success", title: r.message ?? "Saved" });
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="panel" noValidate>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Booking details</h2>
          <p className="panel-meta">{editable ? "Every change is checked against capacity and written to the history below." : "Your role can view but not change bookings."}</p>
        </div>
        {editable ? (
          <div className="flex items-center gap-2">
            {dirty ? <span className="text-xs text-warning">Unsaved changes</span> : null}
            <Button type="submit" size="sm" loading={pending} disabled={!dirty}>Save changes</Button>
          </div>
        ) : null}
      </div>
      <fieldset disabled={!editable || pending} className="panel-body grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="bk-night" label="Night" error={errors.event_night_id} help={night ? `${spare} of ${night.capacity} places available${night.status === "cancelled" ? " · cancelled" : ""}` : undefined} required>
          <Select id="bk-night" value={nightId} onChange={(e) => setNightId(e.target.value)}>
            {nights.map((n) => (
              <option key={n.id} value={n.id} disabled={n.status === "cancelled" && n.id !== b.event_night_id}>
                {formatDateOnly(n.date)} · season {n.season_year}{n.status === "cancelled" ? " (cancelled)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="bk-time" label="Entry time" error={errors.entry_time} required>
          <Select id="bk-time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)}>
            {!SLOTS.includes(entryTime) ? <option value={entryTime}>{entryTime}</option> : null}
            {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field id="bk-status" label="Status" error={errors.status} help={b.status === "refunded" ? "Refunded bookings cannot be reinstated." : "Use the Refund action to refund or void tickets."} required>
          <Select id="bk-status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={b.status === "refunded"}>
            <option value="confirmed">Confirmed</option>
            <option value="transferred">Moved to another night</option>
            <option value="no_show">No show</option>
            <option value="refunded" disabled={b.total_paid_pence - b.refunded_pence > 0}>Refunded (tickets void)</option>
          </Select>
        </Field>
        <Field id="bk-type" label="Ticket type" error={errors.ticket_type} required>
          <Select id="bk-type" value={ticketType} onChange={(e) => setTicketType(e.target.value)}>
            {Object.entries(TICKET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field id="bk-size" label="Group size" error={errors.group_size} required>
          <Input id="bk-size" type="number" min={1} max={60} value={groupSize} onChange={(e) => setGroupSize(e.target.value)} className="tabular" />
        </Field>
        <Field id="bk-paid" label="Total paid (£)" error={errors.total_paid_pence} help={b.refunded_pence ? `${formatMoney(b.refunded_pence)} already refunded` : undefined} required>
          <Input id="bk-paid" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} className="tabular" />
        </Field>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <span className="text-[13px] font-medium text-muted-strong">Add-ons</span>
          <div className="flex flex-wrap gap-4">
            {ADDONS.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={addons.includes(a.key)} onChange={(e) => setAddons((cur) => (e.target.checked ? [...cur, a.key] : cur.filter((x) => x !== a.key)))} />
                {a.name} <span className="text-xs text-muted">{formatMoney(a.pricePence)} pp</span>
              </label>
            ))}
          </div>
        </div>
        <Field id="bk-note" label="Reason for change" help="Optional. Saved in the history with your name." className="sm:col-span-2 lg:col-span-3">
          <Input id="bk-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Guest phoned to add two friends" maxLength={300} />
        </Field>
        {formError ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2 lg:col-span-3">{formError}</p> : null}
      </fieldset>
    </form>
  );
}
