/**
 * SLA timing. A ticket has a due time derived from its priority. The timer
 * is green while comfortably inside the window, amber when it is close
 * (under 25% of the window left, or under 2 hours), and red once overdue.
 */
export type Priority = "low" | "normal" | "high" | "urgent";

export type SlaPolicies = Record<Priority, number>; // hours

export interface SlaState {
  status: "ok" | "amber" | "red" | "resolved";
  remainingMs: number; // negative when overdue
  /** 0 = just created, 1 = due now, >1 = overdue */
  fraction: number;
  label: string;
}

export function computeDueAt(createdAt: Date, priority: Priority, policies: SlaPolicies): Date {
  const hours = policies[priority] ?? policies.normal ?? 24;
  return new Date(createdAt.getTime() + hours * 3_600_000);
}

const HOUR = 3_600_000;

export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 60_000) return "under a minute";
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem ? `${hours} h ${rem} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days} d ${remH} h` : `${days} d`;
}

export function slaState(dueAt: Date, createdAt: Date, now: Date, resolvedAt: Date | null = null): SlaState {
  if (resolvedAt) {
    const late = resolvedAt.getTime() > dueAt.getTime();
    return {
      status: "resolved",
      remainingMs: dueAt.getTime() - resolvedAt.getTime(),
      fraction: (resolvedAt.getTime() - createdAt.getTime()) / Math.max(1, dueAt.getTime() - createdAt.getTime()),
      label: late ? `Resolved ${formatDuration(resolvedAt.getTime() - dueAt.getTime())} late` : "Resolved within SLA",
    };
  }
  const window = Math.max(1, dueAt.getTime() - createdAt.getTime());
  const remaining = dueAt.getTime() - now.getTime();
  const fraction = (now.getTime() - createdAt.getTime()) / window;
  if (remaining < 0) return { status: "red", remainingMs: remaining, fraction, label: `Overdue by ${formatDuration(remaining)}` };
  const amber = remaining < 2 * HOUR || remaining < window * 0.25;
  return { status: amber ? "amber" : "ok", remainingMs: remaining, fraction, label: `${formatDuration(remaining)} left` };
}
