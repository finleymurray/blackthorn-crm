"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateTicket } from "@/app/(app)/support/actions";
import type { TicketDetail } from "@/lib/data/tickets";
import { TICKET_PRIORITY_LABELS } from "@/lib/domain/constants";

export interface FieldConfig {
  categories: Array<{ key: string; label: string }>;
  staff: Array<{ id: string; name: string }>;
}

/** Status, priority, category and assignee as inline selects. */
export function TicketFields({ ticket, config, editable }: { ticket: TicketDetail; config: FieldConfig; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();

  const apply = (patch: Record<string, unknown>) =>
    start(async () => {
      const r = await updateTicket(ticket.id, patch);
      if (!r.ok) {
        toast({ kind: "error", title: "Not changed", description: r.error });
        return;
      }
      if (r.message) toast({ kind: "success", title: r.message });
      router.refresh();
    });

  const selectClass = "h-8 w-full min-w-0 text-[13px]";

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border px-6 py-3 2xl:grid-cols-4" aria-busy={pending}>
      <label htmlFor="tf-status" className="sr-only">
        Status
      </label>
      <Select
        id="tf-status"
        value={ticket.status}
        disabled={!editable || pending}
        className={selectClass}
        onChange={(e) => apply({ status: e.target.value })}
      >
        <option value="new">New</option>
        <option value="open">Open</option>
        <option value="waiting_on_guest">Waiting on guest</option>
        <option value="resolved">Resolved</option>
      </Select>
      <label htmlFor="tf-priority" className="sr-only">
        Priority
      </label>
      <Select id="tf-priority" value={ticket.priority} disabled={!editable || pending} className={selectClass} onChange={(e) => apply({ priority: e.target.value })}>
        {(Object.keys(TICKET_PRIORITY_LABELS) as Array<keyof typeof TICKET_PRIORITY_LABELS>).map((p) => (
          <option key={p} value={p}>
            {TICKET_PRIORITY_LABELS[p]} priority
          </option>
        ))}
      </Select>
      <label htmlFor="tf-category" className="sr-only">
        Category
      </label>
      <Select id="tf-category" value={ticket.category} disabled={!editable || pending} className={selectClass} onChange={(e) => apply({ category: e.target.value })}>
        {config.categories.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </Select>
      <label htmlFor="tf-assignee" className="sr-only">
        Assigned to
      </label>
      <Select id="tf-assignee" value={ticket.assigned_to ?? ""} disabled={!editable || pending} className={selectClass} onChange={(e) => apply({ assigned_to: e.target.value || null })}>
        <option value="">Unassigned</option>
        {config.staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>

    </div>
  );
}
