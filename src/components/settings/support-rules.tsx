"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveCategory, saveSla, toggleCategory } from "@/app/(app)/settings/actions";
import type { TicketCategory } from "@/lib/data/support-config";
import type { SlaPolicies } from "@/lib/support/sla";
import { TICKET_PRIORITY_LABELS } from "@/lib/domain/constants";

export function SupportRules({ categories, sla }: { categories: TicketCategory[]; sla: SlaPolicies }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const done = (r: { ok: boolean; message?: string; error?: string }) => {
    if (!r.ok) toast({ kind: "error", title: r.error ?? "Not saved" });
    else {
      if (r.message) toast({ kind: "success", title: r.message });
      router.refresh();
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">SLA times</h3>
            <p className="panel-meta">Hours from a ticket being opened to it becoming overdue</p>
          </div>
        </div>
        <form
          className="panel-body space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => done(await saveSla(Object.fromEntries(fd.entries()))));
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["urgent", "high", "normal", "low"] as const).map((p) => (
              <label key={p} className="space-y-1 text-[13px] text-muted-strong">
                {TICKET_PRIORITY_LABELS[p]}
                <div className="flex items-center gap-1">
                  <Input name={p} type="number" min={1} max={720} defaultValue={sla[p]} className="tabular" />
                  <span className="text-xs text-muted">h</span>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={pending}>
              Save SLA times
            </Button>
          </div>
        </form>
      </section>

      <section className="panel xl:col-span-2">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Ticket categories</h3>
            <p className="panel-meta">Each category sets the default priority for new tickets.</p>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {categories.map((c) => (
            <li key={c.key} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <span className={`min-w-[140px] ${c.active ? "" : "text-muted line-through"}`}>
                {c.label} <span className="ml-1 text-xs text-muted">{c.key}</span>
              </span>
              <label htmlFor={`cat-pri-${c.key}`} className="sr-only">
                Default priority for {c.label}
              </label>
              <Select
                id={`cat-pri-${c.key}`}
                value={c.default_priority}
                disabled={pending}
                onChange={(e) => start(async () => done(await saveCategory({ key: c.key, label: c.label, default_priority: e.target.value })))}
                className="h-7 w-auto text-[13px]"
              >
                {(Object.keys(TICKET_PRIORITY_LABELS) as Array<keyof typeof TICKET_PRIORITY_LABELS>).map((p) => (
                  <option key={p} value={p}>
                    Default: {TICKET_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
              <span className="ml-auto">
                <Switch aria-label={`${c.label} enabled`} checked={c.active} disabled={pending} onCheckedChange={(v) => start(async () => done(await toggleCategory(c.key, v)))} />
              </span>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap items-end gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const label = String(fd.get("label"));
            start(async () => {
              const r = await saveCategory({ key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label, default_priority: fd.get("default_priority") });
              done(r);
              if (r.ok) form.reset();
            });
          }}
        >
          <label className="flex-1 space-y-1 text-xs text-muted">
            New category
            <Input name="label" placeholder="e.g. Group bookings" required maxLength={40} />
          </label>
          <label className="space-y-1 text-xs text-muted">
            Default priority
            <Select name="default_priority" defaultValue="normal" className="w-auto">
              {(Object.keys(TICKET_PRIORITY_LABELS) as Array<keyof typeof TICKET_PRIORITY_LABELS>).map((p) => (
                <option key={p} value={p}>
                  {TICKET_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            <Plus /> Add
          </Button>
        </form>
      </section>
    </div>
  );
}
