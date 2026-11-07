"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { slaState } from "@/lib/support/sla";
import { cn } from "@/lib/utils";

/**
 * Live SLA countdown. Green inside the window, amber when it is close, red
 * once overdue. Updates every 30 seconds without a page refresh.
 */
export function SlaTimer({
  dueAt,
  createdAt,
  resolvedAt,
  compact = false,
  className,
}: {
  dueAt: Date | string;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  compact?: boolean;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const s = slaState(new Date(dueAt), new Date(createdAt), now, resolvedAt ? new Date(resolvedAt) : null);
  const tone =
    s.status === "red" ? "text-danger" : s.status === "amber" ? "text-warning" : s.status === "resolved" ? (s.label.includes("late") ? "text-muted" : "text-success") : "text-success";
  const bar = s.status === "red" ? "bg-danger" : s.status === "amber" ? "bg-warning" : "bg-success";

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs tabular", tone, className)} title={s.label}>
        <Clock className="size-3" aria-hidden />
        {s.status === "resolved" ? (s.label.includes("late") ? "late" : "on time") : s.status === "red" ? `−${s.label.replace("Overdue by ", "")}` : s.label.replace(" left", "")}
      </span>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)} role="status" aria-live="polite">
      <div className="flex items-center justify-between text-[13px]">
        <span className="inline-flex items-center gap-1 text-muted">
          <Clock className="size-3" aria-hidden /> SLA
        </span>
        <span className={cn("whitespace-nowrap tabular font-medium", tone)}>{s.label}</span>
      </div>
      {s.status !== "resolved" ? (
        <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
          <div className={cn("h-full transition-[width]", bar)} style={{ width: `${Math.min(100, Math.max(2, s.fraction * 100))}%` }} />
        </div>
      ) : null}
    </div>
  );
}
