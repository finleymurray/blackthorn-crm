"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import type { TicketListParams } from "@/lib/data/tickets";
import { cn } from "@/lib/utils";

export function TicketFilters({
  params,
  counts,
  categories,
  currentId,
}: {
  params: TicketListParams;
  counts: Record<string, number>;
  categories: Array<{ key: string; label: string }>;
  currentId?: string;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState(params.q);

  const push = React.useCallback(
    (next: Partial<TicketListParams>) => {
      const m = { ...params, ...next, page: 1 };
      const sp = new URLSearchParams();
      if (m.q) sp.set("q", m.q);
      if (m.status !== "unresolved") sp.set("status", m.status);
      if (m.category) sp.set("category", m.category);
      if (m.priority) sp.set("priority", m.priority);
      if (m.mine) sp.set("mine", "1");
      if (m.overdue) sp.set("overdue", "1");
      router.push(`/support${currentId ? `/${currentId}` : ""}${sp.size ? `?${sp}` : ""}`);
    },
    [params, router, currentId],
  );

  React.useEffect(() => {
    if (q === params.q) return;
    const t = window.setTimeout(() => push({ q }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const views: Array<{ key: string; label: string; active: boolean; apply: () => void; count?: number }> = [
    { key: "unresolved", label: "Open", active: params.status === "unresolved" && !params.mine && !params.overdue, apply: () => push({ status: "unresolved", mine: "", overdue: "" }), count: counts.unresolved },
    { key: "mine", label: "Mine", active: !!params.mine, apply: () => push({ mine: params.mine ? "" : "1", overdue: "", status: "unresolved" }), count: counts.mine },
    { key: "overdue", label: "Overdue", active: !!params.overdue, apply: () => push({ overdue: params.overdue ? "" : "1", mine: "", status: "unresolved" }), count: counts.overdue },
    { key: "new", label: "New", active: params.status === "new", apply: () => push({ status: "new", mine: "", overdue: "" }), count: counts.new },
    { key: "resolved", label: "Resolved", active: params.status === "resolved", apply: () => push({ status: "resolved", mine: "", overdue: "" }) },
    { key: "all", label: "All", active: params.status === "all" && !params.mine && !params.overdue, apply: () => push({ status: "all", mine: "", overdue: "" }) },
  ];

  return (
    <div className="space-y-2 border-b border-border p-2.5">
      <div className="relative">
        <label htmlFor="ticket-q" className="sr-only">
          Search tickets
        </label>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="ticket-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, name, email or #" className="pl-8" autoComplete="off" />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Views">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={v.apply}
            aria-pressed={v.active}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              v.active ? "bg-white/[0.08] text-foreground" : "text-muted hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            {v.label}
            {v.count !== undefined ? <span className={cn("tabular", v.key === "overdue" && v.count > 0 ? "text-danger" : "text-muted")}>{v.count}</span> : null}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <label htmlFor="ticket-category" className="sr-only">
          Category
        </label>
        <Select id="ticket-category" value={params.category} onChange={(e) => push({ category: e.target.value })} className="h-7 min-w-0 flex-1 text-[11px]">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        <label htmlFor="ticket-priority" className="sr-only">
          Priority
        </label>
        <Select id="ticket-priority" value={params.priority} onChange={(e) => push({ priority: e.target.value as TicketListParams["priority"] })} className="h-7 min-w-0 flex-1 text-[11px]">
          <option value="">Any priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </Select>
      </div>
    </div>
  );
}
