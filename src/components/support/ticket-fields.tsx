"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateTicket } from "@/app/(app)/support/actions";
import type { TicketDetail } from "@/lib/data/tickets";
import { TICKET_PRIORITY_LABELS } from "@/lib/domain/constants";

export interface FieldConfig {
  categories: Array<{ key: string; label: string }>;
  rootCauses: Array<{ key: string; label: string }>;
  staff: Array<{ id: string; name: string }>;
}

/** Status, priority, category and assignee as inline selects, plus the complaint resolution guard. */
export function TicketFields({ ticket, config, editable }: { ticket: TicketDetail; config: FieldConfig; editable: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = React.useTransition();
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const isComplaint = ticket.category === "complaint";

  const apply = (patch: Record<string, unknown>) =>
    start(async () => {
      const r = await updateTicket(ticket.id, patch);
      if (!r.ok) {
        toast({ kind: "error", title: "Not changed", description: r.error });
        if (patch.status === "resolved" && isComplaint) setResolveOpen(true);
        return;
      }
      if (r.message) toast({ kind: "success", title: r.message });
      router.refresh();
    });

  const selectClass = "h-7 w-auto min-w-0 text-[11px]";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-black/10 px-3 py-2" aria-busy={pending}>
      <label htmlFor="tf-status" className="sr-only">
        Status
      </label>
      <Select
        id="tf-status"
        value={ticket.status}
        disabled={!editable || pending}
        className={selectClass}
        onChange={(e) => {
          const status = e.target.value;
          if (status === "resolved" && isComplaint && (!ticket.root_cause || !ticket.final_response)) {
            setResolveOpen(true);
            e.target.value = ticket.status;
            return;
          }
          apply({ status });
        }}
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

      {isComplaint ? (
        <div className="ml-auto flex items-center gap-1.5">
          {ticket.root_cause && ticket.final_response ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <CheckCircle2 className="size-3" aria-hidden /> Root cause: {config.rootCauses.find((r) => r.key === ticket.root_cause)?.label ?? ticket.root_cause}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-warning">
              <AlertTriangle className="size-3" aria-hidden /> Complaint: needs root cause and final response to resolve
            </span>
          )}
          {editable ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setResolveOpen(true)}>
              {ticket.status === "resolved" ? "Edit outcome" : "Resolve complaint"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isComplaint ? <ResolveComplaintDialog open={resolveOpen} onOpenChange={setResolveOpen} ticket={ticket} rootCauses={config.rootCauses} /> : null}
    </div>
  );
}

function ResolveComplaintDialog({ open, onOpenChange, ticket, rootCauses }: { open: boolean; onOpenChange: (o: boolean) => void; ticket: TicketDetail; rootCauses: Array<{ key: string; label: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rootCause, setRootCause] = React.useState(ticket.root_cause ?? "");
  const [finalResponse, setFinalResponse] = React.useState(ticket.final_response ?? "");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const save = (resolve: boolean) =>
    start(async () => {
      const r = await updateTicket(ticket.id, { root_cause: rootCause || null, final_response: finalResponse, ...(resolve ? { status: "resolved" } : {}) });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      onOpenChange(false);
      toast({ kind: "success", title: resolve ? "Complaint resolved" : "Outcome saved" });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Complaint outcome</DialogTitle>
          <DialogDescription>Every complaint needs a root cause tag and a final response before it can be resolved. The final response is the formal position sent to the guest and kept on record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="rc-cause" className="text-xs font-medium text-muted-strong">
              Root cause <span className="text-danger">*</span>
            </label>
            <Select id="rc-cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)}>
              <option value="">Choose a root cause…</option>
              {rootCauses.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="rc-final" className="text-xs font-medium text-muted-strong">
              Final response <span className="text-danger">*</span>
            </label>
            <Textarea id="rc-final" value={finalResponse} onChange={(e) => setFinalResponse(e.target.value)} rows={6} placeholder="What we found, what we did about it, and the outcome for the guest." maxLength={5000} />
            <p className="text-[11px] text-muted">{finalResponse.trim().length} characters, at least 20 needed.</p>
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={() => save(false)} loading={pending}>
            Save outcome
          </Button>
          <Button type="button" onClick={() => save(true)} loading={pending}>
            Save and resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
