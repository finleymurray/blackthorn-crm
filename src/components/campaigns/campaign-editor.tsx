"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, Mail, MessageSquare, Monitor, Send, Smartphone, Trash2, FlaskConical } from "lucide-react";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BlockEditor, MergeFieldMenu, insertAtCaret } from "./block-editor";
import { deleteCampaignAction, duplicateCampaignAction, saveCampaign, scheduleCampaignAction, sendCampaign, sendCampaignTest, unscheduleCampaignAction } from "@/app/(app)/campaigns/actions";
import type { CampaignRow } from "@/lib/data/campaigns";
import type { EmailBlock } from "@/lib/messaging/email-blocks";
import { renderMergeFields } from "@/lib/messaging/merge";
import { smsStats } from "@/lib/messaging/sms";
import { SAMPLE_VALUES } from "@/lib/data/campaigns";
import { EXCLUSION_LABELS, type AudienceSummary, type ExclusionReason } from "@/lib/segments/consent";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PreviewData {
  html: string | null;
  audience: AudienceSummary | null;
  smsSender: string;
}

export function CampaignEditor({
  campaign,
  segments,
  defaultChannel = "email",
  readOnly = false,
}: {
  campaign: CampaignRow | null;
  segments: Array<{ id: string; name: string }>;
  defaultChannel?: "email" | "sms";
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(campaign?.name ?? "");
  const [channel, setChannel] = React.useState<"email" | "sms">(campaign?.channel ?? defaultChannel);
  const [segmentId, setSegmentId] = React.useState<string>(campaign?.segment_id ?? "");
  const [subject, setSubject] = React.useState(campaign?.subject ?? "");
  const [preheader, setPreheader] = React.useState(campaign?.preheader ?? "");
  const [blocks, setBlocks] = React.useState<EmailBlock[]>(campaign?.blocks ?? []);
  const [smsBody, setSmsBody] = React.useState(campaign?.sms_body ?? "");
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const smsRef = React.useRef<HTMLTextAreaElement>(null);
  const subjectRef = React.useRef<HTMLInputElement>(null);

  const snapshot = JSON.stringify({ name, channel, segmentId, subject, preheader, blocks, smsBody });
  const [savedSnapshot, setSavedSnapshot] = React.useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  const locked = readOnly || campaign?.status === "scheduled";

  // Live preview and audience, debounced.
  React.useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/campaigns/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocks: channel === "email" ? blocks : undefined, segment_id: segmentId || null, channel }),
          signal: controller.signal,
        });
        if (res.ok) setPreview((await res.json()) as PreviewData);
      } catch {
        /* ignore aborted */
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [blocks, segmentId, channel]);

  const input = () => ({ name, channel, segment_id: segmentId || null, subject, preheader, blocks, sms_body: smsBody });

  const save = (then?: (id: string) => void) =>
    start(async () => {
      const r = await saveCampaign(campaign?.id ?? null, input());
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setFormError(r.error);
        return;
      }
      setErrors({});
      setFormError(null);
      setSavedSnapshot(snapshot);
      if (!campaign) {
        router.push(`/campaigns/${r.id}`);
        toast({ kind: "success", title: "Campaign created" });
      } else {
        toast({ kind: "success", title: "Campaign saved" });
        router.refresh();
      }
      then?.(r.id);
    });

  const testSend = () => {
    if (!campaign) return;
    start(async () => {
      if (dirty) {
        const r = await saveCampaign(campaign.id, input());
        if (!r.ok) {
          setFormError(r.error);
          return;
        }
        setSavedSnapshot(snapshot);
      }
      const r = await sendCampaignTest(campaign.id);
      if (!r.ok) toast({ kind: "error", title: "Test failed", description: r.error });
      else toast({ kind: "success", title: "Test sent to the outbox", description: `Open it from the Outbox page.` });
    });
  };

  const sendNow = () => {
    if (!campaign) return;
    start(async () => {
      if (dirty) {
        const r = await saveCampaign(campaign.id, input());
        if (!r.ok) {
          setFormError(r.error);
          setSendOpen(false);
          return;
        }
      }
      const r = await sendCampaign(campaign.id);
      setSendOpen(false);
      if (!r.ok) toast({ kind: "error", title: "Not sent", description: r.error });
      else {
        toast({ kind: "success", title: "Campaign sent", description: r.message });
        router.push(`/campaigns/${campaign.id}/report`);
      }
    });
  };

  const sms = smsStats(renderMergeFields(smsBody, SAMPLE_VALUES));
  const audience = preview?.audience ?? null;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Campaigns", href: "/campaigns" }]}
        title={campaign ? campaign.name : "New campaign"}
        meta={campaign?.status === "scheduled" ? `Scheduled for ${formatDateTime(campaign.scheduled_for)}` : undefined}
        actions={
          <>
            {campaign && !readOnly ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => start(() => duplicateCampaignAction(campaign.id))} disabled={pending}>
                  <Copy /> Duplicate
                </Button>
                {campaign.status === "draft" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Delete this draft campaign?")) return;
                      start(async () => {
                        const r = await deleteCampaignAction(campaign.id);
                        if (!r.ok) toast({ kind: "error", title: "Could not delete", description: r.error });
                        else router.push("/campaigns");
                      });
                    }}
                  >
                    <Trash2 /> Delete
                  </Button>
                ) : null}
              </>
            ) : null}
            {campaign?.status === "scheduled" && !readOnly ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await unscheduleCampaignAction(campaign.id);
                    if (r.ok) {
                      toast({ kind: "info", title: "Back to draft" });
                      router.refresh();
                    }
                  })
                }
              >
                Unschedule
              </Button>
            ) : null}
            {!locked ? (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={() => save()} loading={pending} disabled={!dirty && !!campaign}>
                  {campaign ? "Save" : "Create draft"}
                </Button>
                {campaign ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={testSend} disabled={pending}>
                      <FlaskConical /> Send test
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setScheduleOpen(true)} disabled={pending || !segmentId}>
                      <CalendarClock /> Schedule
                    </Button>
                    <Button type="button" size="sm" onClick={() => setSendOpen(true)} disabled={pending || !segmentId}>
                      <Send /> Send now
                    </Button>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        }
      />
      <PageBody wide className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <div className="min-w-0 space-y-5">
          {formError ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}
          {campaign?.status === "scheduled" ? (
            <p className="rounded-md bg-info-soft px-3 py-2 text-sm text-info">This campaign is scheduled. Unschedule it to make changes.</p>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Setup</h2>
            </div>
            <div className="panel-body grid gap-4 sm:grid-cols-2">
              <Field id="c-name" label="Campaign name" error={errors.name} required className="sm:col-span-2">
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Halloween week last tickets" maxLength={100} readOnly={locked} aria-invalid={!!errors.name} />
              </Field>
              <div className="space-y-1.5">
                <span className="text-[13px] font-medium text-muted-strong">Channel</span>
                <div className="flex gap-1 rounded-md bg-white/[0.04] p-1" role="radiogroup" aria-label="Channel">
                  {(["email", "sms"] as const).map((ch) => {
                    const Icon = ch === "email" ? Mail : MessageSquare;
                    return (
                      <button
                        key={ch}
                        type="button"
                        role="radio"
                        aria-checked={channel === ch}
                        disabled={locked || (!!campaign && campaign.channel !== ch && (campaign.blocks.length > 0 || !!campaign.sms_body))}
                        onClick={() => setChannel(ch)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-[4px] py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                          channel === ch ? "bg-white/[0.08] text-foreground" : "text-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden /> {ch === "email" ? "Email" : "SMS"}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field id="c-segment" label="Segment" error={errors.segment_id} required help={!segments.length ? "Create a segment first." : undefined}>
                <Select id="c-segment" value={segmentId} onChange={(e) => setSegmentId(e.target.value)} disabled={locked} aria-invalid={!!errors.segment_id}>
                  <option value="">Choose a segment…</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {channel === "email" ? (
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Email</h2>
                <MergeFieldMenu disabled={locked} onInsert={(t) => setSubject((s) => insertAtCaret(subjectRef.current, s, t))} />
              </div>
              <div className="panel-body space-y-4">
                <Field id="c-subject" label="Subject line" error={errors.subject} required>
                  <Input ref={subjectRef} id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} readOnly={locked} aria-invalid={!!errors.subject} />
                </Field>
                <Field id="c-preheader" label="Preview text" help="Shown next to the subject in most inboxes.">
                  <Input id="c-preheader" value={preheader} onChange={(e) => setPreheader(e.target.value)} maxLength={150} readOnly={locked} />
                </Field>
                <div className="space-y-1.5">
                  <span className="text-[13px] font-medium text-muted-strong">Content</span>
                  <BlockEditor blocks={blocks} onChange={setBlocks} readOnly={locked} />
                </div>
              </div>
            </section>
          ) : (
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Text message</h2>
                <MergeFieldMenu disabled={locked} onInsert={(t) => setSmsBody((s) => insertAtCaret(smsRef.current, s, t))} />
              </div>
              <div className="panel-body space-y-2">
                <Field id="c-sms" label="Message" error={errors.sms_body} required>
                  <Textarea ref={smsRef} id="c-sms" value={smsBody} onChange={(e) => setSmsBody(e.target.value)} rows={5} maxLength={640} readOnly={locked} aria-invalid={!!errors.sms_body} />
                </Field>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted" aria-live="polite">
                  <span>
                    <span className={cn("tabular", sms.characters > 160 && "text-warning")}>{sms.characters}</span> characters
                  </span>
                  <span>
                    <span className="tabular">{sms.segments}</span> segment{sms.segments === 1 ? "" : "s"} ({sms.encoding}, {sms.perSegment} per segment)
                  </span>
                  {sms.encoding === "UCS-2" ? <span className="text-warning">An emoji or special character has halved the limit.</span> : null}
                  <span>Counted with sample merge values.</span>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-16 xl:self-start">
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Audience</h2>
              {audience ? (
                <span className="tabular text-sm">
                  <span className="font-medium text-success">{formatNumber(audience.eligible)}</span>
                  <span className="text-muted"> will receive it</span>
                </span>
              ) : null}
            </div>
            <div className="panel-body">
              {!segmentId ? (
                <p className="text-[13px] text-muted">Choose a segment to see who will receive this campaign.</p>
              ) : !audience ? (
                <p className="text-[13px] text-muted">Calculating…</p>
              ) : (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                    <div className="h-full bg-success" style={{ width: `${audience.total ? (100 * audience.eligible) / audience.total : 0}%` }} />
                  </div>
                  <dl className="mt-3 space-y-1 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-muted">In segment</dt>
                      <dd className="tabular">{formatNumber(audience.total)}</dd>
                    </div>
                    {(Object.entries(audience.reasons) as Array<[ExclusionReason, number]>).map(([reason, n]) => (
                      <div key={reason} className="flex justify-between">
                        <dt className="text-muted">Excluded: {EXCLUSION_LABELS[reason].toLowerCase()}</dt>
                        <dd className="tabular text-muted-strong">−{formatNumber(n)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-border pt-1 font-medium">
                      <dt>Recipients</dt>
                      <dd className="tabular">{formatNumber(audience.eligible)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-snug text-muted">Only guests with {channel === "email" ? "email" : "SMS"} marketing consent are sent to. This is checked again when you press send.</p>
                </>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Preview</h2>
              {channel === "email" ? (
                <div className="flex gap-0.5 rounded-md bg-white/[0.04] p-0.5" role="radiogroup" aria-label="Preview width">
                  {(["desktop", "mobile"] as const).map((d) => {
                    const Icon = d === "desktop" ? Monitor : Smartphone;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={device === d}
                        onClick={() => setDevice(d)}
                        className={cn("rounded-[4px] p-1 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", device === d && "bg-white/[0.08] text-foreground")}
                        aria-label={d === "desktop" ? "Desktop preview" : "Mobile preview"}
                      >
                        <Icon className="size-3.5" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="bg-black/20 p-3">
              {channel === "email" ? (
                <div className={cn("mx-auto overflow-hidden rounded-md bg-white shadow-lg transition-[width]", device === "mobile" ? "w-[375px] max-w-full" : "w-full")}>
                  <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-800">
                    <div className="truncate font-medium">{renderMergeFields(subject || "(no subject)", SAMPLE_VALUES)}</div>
                    <div className="truncate text-neutral-500">{renderMergeFields(preheader, SAMPLE_VALUES) || "Preview text appears here"}</div>
                  </div>
                  {preview?.html ? (
                    <iframe title="Email preview" srcDoc={preview.html} sandbox="" className={cn("w-full bg-white", device === "mobile" ? "h-[560px]" : "h-[620px]")} />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-[13px] text-neutral-500">Rendering preview…</div>
                  )}
                </div>
              ) : (
                <div className="mx-auto w-[300px] max-w-full rounded-[28px] border-[6px] border-white/[0.10] bg-background p-3 pt-6">
                  <p className="mb-3 text-center text-xs text-muted">{preview?.smsSender ?? "Blackthorn"}</p>
                  <div className="ml-2 mr-10 rounded-2xl rounded-bl-sm bg-white/[0.08] px-3 py-2 text-sm leading-snug text-foreground">{renderMergeFields(smsBody || "Your message appears here", SAMPLE_VALUES)}</div>
                  <p className="mt-1 ml-3 text-[11px] text-muted">Delivered</p>
                </div>
              )}
            </div>
          </section>
          {campaign ? (
            <p className="px-1 text-xs text-muted">
              <Badge variant={campaign.status === "scheduled" ? "info" : "default"} dot className="mr-1.5">
                {campaign.status === "scheduled" ? "Scheduled" : "Draft"}
              </Badge>
              Created {formatDateTime(campaign.created_at)}
              {campaign.created_by_name ? ` by ${campaign.created_by_name}` : ""}.
            </p>
          ) : null}
        </aside>
      </PageBody>

      {campaign ? (
        <>
          <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} campaignId={campaign.id} dirty={dirty} saveFirst={() => saveCampaign(campaign.id, input())} />
          <Dialog open={sendOpen} onOpenChange={setSendOpen}>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Send “{name || campaign.name}” now?</DialogTitle>
                <DialogDescription>
                  {audience ? `${formatNumber(audience.eligible)} guests will receive this ${channel === "email" ? "email" : "text"}. ${formatNumber(audience.excluded)} in the segment are excluded for consent or because they are banned.` : "Calculating the audience…"}
                </DialogDescription>
              </DialogHeader>
              <p className="rounded-md bg-white/[0.04] px-3 py-2 text-[13px] text-muted">Demo: every message is written to the outbox. Nothing is sent to a real inbox or phone.</p>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setSendOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={sendNow} loading={pending}>
                  <Send /> Send to {audience ? formatNumber(audience.eligible) : "…"} guests
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  campaignId,
  dirty,
  saveFirst,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  dirty: boolean;
  saveFirst: () => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [when, setWhen] = React.useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Schedule campaign</DialogTitle>
          <DialogDescription>Pick when it should go out. Times are Europe/London.</DialogDescription>
        </DialogHeader>
        <Field id="sched-when" label="Send at" error={error} required>
          <Input id="sched-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={pending}
            onClick={() =>
              start(async () => {
                if (dirty) {
                  const s = await saveFirst();
                  if (!s.ok) {
                    setError("Fix the errors in the campaign first.");
                    return;
                  }
                }
                const r = await scheduleCampaignAction(campaignId, { when });
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                onOpenChange(false);
                toast({ kind: "success", title: "Campaign scheduled" });
                router.refresh();
              })
            }
          >
            <CalendarClock /> Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
