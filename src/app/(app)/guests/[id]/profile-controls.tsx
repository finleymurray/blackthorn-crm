"use client";

import * as React from "react";
import { Mail, MessageSquare, Pencil, Plus, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { addGuestNote, saveGuestDetails, saveGuestTags, setGuestConsent, type ActionResult } from "./actions";
import type { Guest } from "@/lib/data/guests";

export function EditGuestDialog({ guest }: { guest: Guest }) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const { toast } = useToast();
  const errors = result && !result.ok ? result.fieldErrors ?? {} : {};
  const [banned, setBanned] = React.useState(guest.banned);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      first_name: fd.get("first_name"),
      last_name: fd.get("last_name"),
      email: fd.get("email"),
      phone: fd.get("phone") ?? "",
      postcode: fd.get("postcode") ?? "",
      date_of_birth: fd.get("date_of_birth") ?? "",
      accessibility_needs: fd.get("accessibility_needs") ?? "",
      do_not_touch: fd.get("do_not_touch") === "on",
      banned: fd.get("banned") === "on",
      banned_reason: fd.get("banned_reason") ?? "",
    };
    start(async () => {
      const r = await saveGuestDetails(guest.id, input);
      setResult(r);
      if (r.ok) {
        toast({ kind: "success", title: "Guest updated", description: "The change has been logged." });
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Pencil /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit guest</DialogTitle>
          <DialogDescription>Changes are recorded in the activity log with your name.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="first_name" label="First name" error={errors.first_name} required>
              <Input id="first_name" name="first_name" defaultValue={guest.first_name} aria-invalid={!!errors.first_name} required />
            </Field>
            <Field id="last_name" label="Last name" error={errors.last_name} required>
              <Input id="last_name" name="last_name" defaultValue={guest.last_name} aria-invalid={!!errors.last_name} required />
            </Field>
            <Field id="email" label="Email" error={errors.email} required>
              <Input id="email" name="email" type="email" defaultValue={guest.email} aria-invalid={!!errors.email} required />
            </Field>
            <Field id="phone" label="Phone" error={errors.phone} help="UK mobile or landline">
              <Input id="phone" name="phone" type="tel" defaultValue={guest.phone ?? ""} aria-invalid={!!errors.phone} />
            </Field>
            <Field id="postcode" label="Postcode" error={errors.postcode}>
              <Input id="postcode" name="postcode" defaultValue={guest.postcode ?? ""} aria-invalid={!!errors.postcode} className="uppercase" />
            </Field>
            <Field id="date_of_birth" label="Date of birth" error={errors.date_of_birth} help="Optional. Used for 18+ checks.">
              <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={guest.date_of_birth ?? ""} aria-invalid={!!errors.date_of_birth} />
            </Field>
          </div>
          <Field id="accessibility_needs" label="Accessibility needs" error={errors.accessibility_needs} help="Shown prominently to front desk and support.">
            <Textarea id="accessibility_needs" name="accessibility_needs" defaultValue={guest.accessibility_needs ?? ""} rows={2} />
          </Field>
          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="do_not_touch" defaultChecked={guest.do_not_touch} /> Do not touch request (no contact in Nightfall Manor)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="banned" checked={banned} onChange={(e) => setBanned(e.target.checked)} /> Banned from the park
            </label>
            {banned ? (
              <Field id="banned_reason" label="Ban reason" error={errors.banned_reason}>
                <Textarea id="banned_reason" name="banned_reason" defaultValue={guest.banned_reason ?? ""} rows={2} />
              </Field>
            ) : null}
          </div>
          {result && !result.ok ? (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger">
              {result.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConsentControls({
  guestId,
  channel,
  value,
  at,
  source,
  editable,
}: {
  guestId: string;
  channel: "email" | "sms";
  value: boolean;
  at: string | null;
  source: string | null;
  editable: boolean;
}) {
  const [pending, start] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState(value);
  const [prevValue, setPrevValue] = React.useState(value);
  const { toast } = useToast();
  if (value !== prevValue) {
    setPrevValue(value);
    setOptimistic(value);
  }
  const Icon = channel === "email" ? Mail : MessageSquare;
  const id = `consent-${channel}`;

  return (
    <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Icon className="size-4 text-muted" aria-hidden />
        <div>
          <p className="text-[13px] font-medium" id={`${id}-label`}>
            {channel === "email" ? "Email marketing" : "SMS marketing"}{" "}
            <Badge variant={optimistic ? "success" : "default"} dot className="ml-1">
              {optimistic ? "Opted in" : "Not opted in"}
            </Badge>
          </p>
          <p className="text-xs text-muted">{at ? `${optimistic ? "Given" : "Withdrawn"} ${at}${source ? ` · ${source}` : ""}` : "No consent recorded"}</p>
        </div>
      </div>
      {editable ? (
        <Switch
          id={id}
          aria-labelledby={`${id}-label`}
          checked={optimistic}
          disabled={pending}
          onCheckedChange={(next) => {
            setOptimistic(next);
            start(async () => {
              const r = await setGuestConsent(guestId, { channel, value: next, source: "staff" });
              if (!r.ok) {
                setOptimistic(!next);
                toast({ kind: "error", title: "Consent not changed", description: r.error });
              } else {
                toast({ kind: "success", title: `${channel === "email" ? "Email" : "SMS"} consent ${next ? "given" : "withdrawn"}`, description: "Logged with a timestamp and source." });
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

export function TagsEditor({ guestId, tags, editable }: { guestId: string; tags: string[]; editable: boolean }) {
  const [list, setList] = React.useState(tags);
  const [draft, setDraft] = React.useState("");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const [prevTags, setPrevTags] = React.useState(tags);
  if (tags !== prevTags) {
    setPrevTags(tags);
    setList(tags);
  }

  const persist = (next: string[]) => {
    setList(next);
    start(async () => {
      const r = await saveGuestTags(guestId, next);
      if (!r.ok) {
        setError(r.error);
        setList(tags);
      } else {
        setError(null);
        toast({ kind: "success", title: "Tags saved" });
      }
    });
  };

  return (
    <div className="panel p-4">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold">
        <Tag className="size-3.5 text-muted" aria-hidden /> Tags
      </h2>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {list.length === 0 ? <p className="text-xs text-muted">No tags yet.</p> : null}
        {list.map((t) => (
          <Badge key={t} variant="outline" className="gap-1 pr-1">
            {t}
            {editable ? (
              <button
                type="button"
                onClick={() => persist(list.filter((x) => x !== t))}
                className="rounded-full p-0.5 text-muted hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={`Remove tag ${t}`}
                disabled={pending}
              >
                <X className="size-3" />
              </button>
            ) : null}
          </Badge>
        ))}
      </div>
      {editable ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim().toLowerCase().replace(/\s+/g, "_");
            if (!t) return;
            if (list.includes(t)) {
              setDraft("");
              return;
            }
            persist([...list, t]);
            setDraft("");
          }}
        >
          <label htmlFor="new-tag" className="sr-only">
            New tag
          </label>
          <Input id="new-tag" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a tag" className="h-8 text-xs" maxLength={30} />
          <Button type="submit" size="sm" variant="secondary" disabled={pending || !draft.trim()} aria-label="Add tag">
            <Plus />
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NotesPanel({ guestId, notes, editable }: { guestId: string; notes: string | null; editable: boolean }) {
  const [draft, setDraft] = React.useState("");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  return (
    <div className="panel p-4">
      <h2 className="text-[13px] font-semibold">Notes</h2>
      {editable ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addGuestNote(guestId, { note: draft });
              if (!r.ok) setError(r.error);
              else {
                setError(null);
                setDraft("");
                toast({ kind: "success", title: "Note added" });
              }
            });
          }}
        >
          <label htmlFor="new-note" className="sr-only">
            New note
          </label>
          <Textarea id="new-note" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a note about this guest…" rows={3} maxLength={2000} aria-invalid={!!error} />
          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending} disabled={!draft.trim()}>
              Add note
            </Button>
          </div>
        </form>
      ) : null}
      <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-strong">{notes ? notes : <span className="text-muted">No notes yet.</span>}</div>
    </div>
  );
}
