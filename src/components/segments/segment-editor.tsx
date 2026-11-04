"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Mail, MessageSquare, Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GroupEditor, type Lookups } from "./rule-editor";
import { duplicateSegment, removeSegment, saveSegment } from "@/app/(app)/segments/actions";
import type { RuleGroup } from "@/lib/segments/types";
import { describeGroup } from "@/lib/segments/compile";
import { EXCLUSION_LABELS, type AudienceSummary, type ExclusionReason } from "@/lib/segments/consent";
import type { PreviewGuest } from "@/lib/data/segments";
import { formatMoney, formatNumber } from "@/lib/format";

interface PreviewResponse {
  count: number;
  preview: PreviewGuest[];
  email: AudienceSummary;
  sms: AudienceSummary;
}

export function SegmentEditor({
  segment,
  initialRules,
  lookups,
  readOnly = false,
}: {
  segment: { id: string; name: string; description: string; campaign_count: number } | null;
  initialRules: RuleGroup;
  lookups: Lookups;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(segment?.name ?? "");
  const [description, setDescription] = React.useState(segment?.description ?? "");
  const [rules, setRules] = React.useState<RuleGroup>(initialRules);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const dirty = name !== (segment?.name ?? "") || description !== (segment?.description ?? "") || JSON.stringify(rules) !== JSON.stringify(initialRules);

  // Live count: re-evaluate on the server whenever the rules change.
  React.useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/segments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Could not evaluate the segment");
        setPreview((await res.json()) as PreviewResponse);
        setPreviewError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setPreviewError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [rules]);

  const onSave = () => {
    start(async () => {
      const r = await saveSegment(segment?.id ?? null, { name, description, rules });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      toast({ kind: "success", title: segment ? "Segment saved" : "Segment created" });
      if (!segment) router.push(`/segments/${r.id}`);
      else router.refresh();
    });
  };

  const onDelete = () => {
    if (!segment) return;
    if (!window.confirm(`Delete the segment "${segment.name}"? This cannot be undone.`)) return;
    start(async () => {
      const r = await removeSegment(segment.id);
      if (!r.ok) {
        toast({ kind: "error", title: "Could not delete", description: r.error });
        return;
      }
      toast({ kind: "success", title: "Segment deleted" });
      router.push("/segments");
    });
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Segments", href: "/segments" }]}
        title={segment ? segment.name : "New segment"}
        meta={preview ? `${formatNumber(preview.count)} guests` : undefined}
        actions={
          <>
            {segment && !readOnly ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => start(() => duplicateSegment(segment.id))} disabled={pending}>
                  <Copy /> Duplicate
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onDelete} disabled={pending} className="text-danger hover:text-danger">
                  <Trash2 /> Delete
                </Button>
              </>
            ) : null}
            {!readOnly ? (
              <Button type="button" size="sm" onClick={onSave} loading={pending} disabled={!dirty && !!segment}>
                {segment ? "Save changes" : "Create segment"}
              </Button>
            ) : null}
          </>
        }
      />
      <PageBody wide className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
            <Field id="seg-name" label="Name" required>
              <Input id="seg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2025 guests not yet booked" maxLength={80} readOnly={readOnly} />
            </Field>
            <Field id="seg-desc" label="Description">
              <Input id="seg-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this audience is for" maxLength={300} readOnly={readOnly} />
            </Field>
          </div>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Rules</h2>
                <p className="panel-meta">{describeGroup(rules)}</p>
              </div>
            </div>
            <div className="panel-body">
              <GroupEditor group={rules} onChange={setRules} lookups={lookups} readOnly={readOnly} />
            </div>
          </section>

          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          ) : null}

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Preview</h2>
                <p className="panel-meta">First 20 matching guests, most recent visit first</p>
              </div>
              {loading ? <Loader2 className="size-3.5 animate-spin text-muted" aria-label="Updating" /> : null}
            </div>
            {previewError ? (
              <p className="px-4 py-6 text-center text-xs text-danger">{previewError}</p>
            ) : !preview ? (
              <p className="px-4 py-6 text-center text-xs text-muted">Evaluating…</p>
            ) : preview.preview.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No guests match these rules.</p>
            ) : (
              <Table flush>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead className="hidden sm:table-cell">Postcode</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.preview.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar name={`${g.first_name} ${g.last_name}`} size="sm" />
                          <Link href={`/guests/${g.id}`} className="hover:underline">
                            {g.first_name} {g.last_name}
                          </Link>
                          {g.banned ? (
                            <Badge variant="danger" dot>
                              Banned
                            </Badge>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted">{g.email}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell tabular">{g.postcode}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={g.email_consent ? "success" : "default"} dot>
                            Email
                          </Badge>
                          <Badge variant={g.sms_consent ? "success" : "default"} dot>
                            SMS
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-right">{g.visit_count}</TableCell>
                      <TableCell className="hidden sm:table-cell tabular text-right">{formatMoney(g.lifetime_spend_pence)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-16 xl:self-start">
          <div className="panel p-4">
            <p className="stat-label">Guests matching</p>
            <p className="stat-value text-3xl">{preview ? formatNumber(preview.count) : "–"}</p>
            <p className="stat-sub">updates as you edit the rules</p>
          </div>
          {preview ? (
            <>
              <ChannelCard channel="email" summary={preview.email} />
              <ChannelCard channel="sms" summary={preview.sms} />
            </>
          ) : null}
          {segment && segment.campaign_count > 0 ? (
            <p className="px-1 text-[11px] leading-relaxed text-muted">
              Used by {segment.campaign_count} campaign{segment.campaign_count === 1 ? "" : "s"}. Changing the rules changes who those campaigns go to next time they send.
            </p>
          ) : null}
        </aside>
      </PageBody>
    </>
  );
}

function ChannelCard({ channel, summary }: { channel: "email" | "sms"; summary: AudienceSummary }) {
  const Icon = channel === "email" ? Mail : MessageSquare;
  const reasons = Object.entries(summary.reasons) as Array<[ExclusionReason, number]>;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-medium">
          <Icon className="size-3.5 text-muted" aria-hidden /> {channel === "email" ? "Email" : "SMS"} send
        </p>
        <span className="tabular text-[13px]">
          <span className="font-medium text-success">{formatNumber(summary.eligible)}</span>
          <span className="text-muted"> / {formatNumber(summary.total)}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className="h-full bg-success" style={{ width: `${summary.total ? (100 * summary.eligible) / summary.total : 0}%` }} />
      </div>
      {summary.excluded > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {reasons.map(([reason, count]) => (
            <li key={reason} className="flex justify-between gap-2">
              <span className="text-muted">{EXCLUSION_LABELS[reason]}</span>
              <span className="tabular text-muted-strong">−{formatNumber(count)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">Everyone in this segment can be contacted by {channel === "email" ? "email" : "SMS"}.</p>
      )}
      <p className="mt-3 text-[11px] leading-snug text-muted">Excluded guests are never sent to. Consent is checked again at send time.</p>
    </div>
  );
}
