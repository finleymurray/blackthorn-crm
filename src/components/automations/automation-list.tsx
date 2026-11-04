"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Mail, MessageSquare, Pencil, Play, FlaskConical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { MergeFieldMenu, insertAtCaret } from "@/components/campaigns/block-editor";
import { runNow, saveAutomation, simulate, toggleAutomation } from "@/app/(app)/automations/actions";
import { TRIGGER_LABELS, type AutomationRow, type SimulatedSend } from "@/lib/data/automations";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

function timingLabel(a: AutomationRow): string {
  if (a.trigger === "post_visit_survey") return `${a.send_at_time?.slice(0, 5) ?? "10:00"} the morning after`;
  if (a.trigger === "win_back") return "1 September each year";
  if (a.delay_minutes === 0) return "Immediately";
  const h = Math.abs(a.delay_minutes) / 60;
  const unit = h % 24 === 0 && h >= 24 ? `${h / 24} day${h / 24 === 1 ? "" : "s"}` : `${h} hour${h === 1 ? "" : "s"}`;
  return a.delay_minutes < 0 ? `${unit} before` : `${unit} after`;
}

export function AutomationList({ automations, editable }: { automations: AutomationRow[]; editable: boolean }) {
  const [editing, setEditing] = React.useState<AutomationRow | null>(null);
  const [simulating, setSimulating] = React.useState<AutomationRow | null>(null);

  return (
    <>
      <ul className="divide-y divide-border rounded-md border border-border">
        {automations.map((a) => (
          <AutomationItem key={a.id} a={a} editable={editable} onEdit={() => setEditing(a)} onSimulate={() => setSimulating(a)} />
        ))}
      </ul>
      {editing ? <EditDialog a={editing} onClose={() => setEditing(null)} /> : null}
      {simulating ? <SimulateDialog a={simulating} onClose={() => setSimulating(null)} editable={editable} /> : null}
    </>
  );
}

function AutomationItem({ a, editable, onEdit, onSimulate }: { a: AutomationRow; editable: boolean; onEdit: () => void; onSimulate: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [active, setActive] = React.useState(a.active);
  const [pending, start] = React.useTransition();
  const Icon = a.channel === "email" ? Mail : MessageSquare;
  const switchId = `auto-${a.id}`;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[13px] font-medium" id={`${switchId}-label`}>
            {a.name}
          </h2>
          <Badge variant={active ? "success" : "default"} dot>
            {active ? "On" : "Off"}
          </Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Icon className="size-3" aria-hidden /> {a.channel === "email" ? "Email" : "SMS"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{a.description}</p>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">Trigger</dt>
            <dd>{TRIGGER_LABELS[a.trigger]}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarClock className="size-3 text-muted" aria-hidden />
            <dt className="sr-only">Timing</dt>
            <dd>{timingLabel(a)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-muted">Sent</dt>
            <dd className="tabular">
              {formatNumber(a.sent_count)}
              {a.last_sent_at ? <span className="text-muted">, last {formatRelative(a.last_sent_at)}</span> : null}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onSimulate}>
          <FlaskConical /> Simulate
        </Button>
        {editable ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              <Pencil /> Edit
            </Button>
            <Switch
              id={switchId}
              aria-labelledby={`${switchId}-label`}
              checked={active}
              disabled={pending}
              onCheckedChange={(next) => {
                setActive(next);
                start(async () => {
                  const r = await toggleAutomation(a.id, next);
                  if (!r.ok) {
                    setActive(!next);
                    toast({ kind: "error", title: "Not changed", description: r.error });
                  } else {
                    router.refresh();
                  }
                });
              }}
            />
          </>
        ) : null}
      </div>
    </li>
  );
}

function EditDialog({ a, onClose }: { a: AutomationRow; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [body, setBody] = React.useState(a.body);
  const [subject, setSubject] = React.useState(a.subject ?? "");
  const [channel, setChannel] = React.useState(a.channel);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const fixedTiming = a.trigger === "booking_confirmed" || a.trigger === "win_back";

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const hours = Number(fd.get("hours") ?? 0);
    const direction = String(fd.get("direction") ?? "before");
    start(async () => {
      const r = await saveAutomation(a.id, {
        name: fd.get("name"),
        channel,
        delay_minutes: a.trigger === "reminder_48h" ? (direction === "before" ? -1 : 1) * Math.round(hours * 60) : a.delay_minutes,
        send_at_time: a.trigger === "post_visit_survey" ? fd.get("send_at_time") : "",
        subject,
        body,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? { form: r.error });
        return;
      }
      toast({ kind: "success", title: "Automation saved" });
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit “{a.name}”</DialogTitle>
          <DialogDescription>{TRIGGER_LABELS[a.trigger]}. Merge fields are filled in per guest when it sends.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="a-name" label="Name" error={errors.name} required>
              <Input id="a-name" name="name" defaultValue={a.name} maxLength={80} />
            </Field>
            <Field id="a-channel" label="Channel">
              <Select id="a-channel" value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms")}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </Field>
            {a.trigger === "reminder_48h" ? (
              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                <Field id="a-hours" label="Send" error={errors.delay_minutes}>
                  <Input id="a-hours" name="hours" type="number" min={1} max={336} step={1} defaultValue={Math.abs(a.delay_minutes) / 60} />
                </Field>
                <Field id="a-direction" label="hours">
                  <Select id="a-direction" name="direction" defaultValue={a.delay_minutes < 0 ? "before" : "after"}>
                    <option value="before">before the entry time</option>
                    <option value="after">after the entry time</option>
                  </Select>
                </Field>
              </div>
            ) : null}
            {a.trigger === "post_visit_survey" ? (
              <Field id="a-time" label="Send at (the morning after)" error={errors.send_at_time} help="24 hour clock, Europe/London">
                <Input id="a-time" name="send_at_time" type="time" defaultValue={a.send_at_time?.slice(0, 5) ?? "10:00"} />
              </Field>
            ) : null}
            {fixedTiming ? <p className="text-xs text-muted sm:col-span-2">Timing: {timingLabel(a)}.</p> : null}
          </div>
          {channel === "email" ? (
            <Field id="a-subject" label="Subject" error={errors.subject} required>
              <Input id="a-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
            </Field>
          ) : null}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="a-body" className="text-xs font-medium text-muted-strong">
                Message
              </label>
              <MergeFieldMenu onInsert={(t) => setBody((b) => insertAtCaret(bodyRef.current, b, t))} />
            </div>
            <Textarea ref={bodyRef} id="a-body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={5000} aria-invalid={!!errors.body} />
            {errors.body ? (
              <p role="alert" className="text-xs text-danger">
                {errors.body}
              </p>
            ) : null}
          </div>
          {errors.form ? (
            <p role="alert" className="text-xs text-danger">
              {errors.form}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SimulateDialog({ a, onClose, editable }: { a: AutomationRow; onClose: () => void; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [result, setResult] = React.useState<{ total: number; sample: SimulatedSend[]; explanation: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState(0);
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    let cancelled = false;
    simulate(a.id).then((r) => {
      if (cancelled) return;
      if (r.ok) setResult({ total: r.total, sample: r.sample, explanation: r.explanation });
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [a.id]);

  const current = result?.sample[selected];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Simulate “{a.name}”</DialogTitle>
          <DialogDescription>Who this automation would message right now, based on the current data. Nothing is sent.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : !result ? (
          <p className="py-8 text-center text-xs text-muted">Working it out…</p>
        ) : (
          <>
            <p className="rounded-md bg-white/[0.04] px-3 py-2 text-xs text-muted-strong">{result.explanation}</p>
            {result.sample.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">Nobody would be messaged right now.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-[240px_1fr]">
                <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border" aria-label="Recipients">
                  {result.sample.map((s, i) => (
                    <li key={`${s.guest_id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setSelected(i)}
                        aria-pressed={selected === i}
                        className={`w-full px-3 py-2 text-left hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${selected === i ? "bg-white/[0.06]" : ""}`}
                      >
                        <span className="block truncate text-[13px]">{s.guest_name}</span>
                        <span className="block truncate text-[11px] text-muted">{s.context}</span>
                        <span className="block text-[11px] text-muted">Would send {formatDateTime(s.when)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {current ? (
                  <div className="min-w-0 rounded-md border border-border">
                    <div className="border-b border-border px-3 py-2 text-xs">
                      <div className="flex gap-2">
                        <span className="w-12 text-muted">To</span>
                        <span className="truncate">
                          {current.guest_name} &lt;{current.to}&gt;
                        </span>
                      </div>
                      {current.subject ? (
                        <div className="mt-1 flex gap-2">
                          <span className="w-12 text-muted">Subject</span>
                          <span className="truncate">{current.subject}</span>
                        </div>
                      ) : null}
                    </div>
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap px-3 py-3 font-sans text-[13px] leading-relaxed text-foreground">{current.body}</pre>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {editable && result && result.total > 0 ? (
            <Button
              type="button"
              variant="secondary"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await runNow(a.id);
                  if (!r.ok) toast({ kind: "error", title: "Could not run", description: r.error });
                  else {
                    toast({ kind: "success", title: "Automation run", description: r.message });
                    onClose();
                    router.refresh();
                  }
                })
              }
            >
              <Play /> Write these to the outbox
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
