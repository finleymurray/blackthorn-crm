import { cn } from "@/lib/utils";

/** Thorn mark: a simple branch with three thorns, drawn in the accent colour. */
export function ThornMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-8", className)} aria-hidden>
      <path d="M16 30V6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 12l-7-5M16 18l7-5M16 24l-6-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 7l-2.5-3.5M23 13l3-3M10 20l-3.5-1" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="4.5" r="1.8" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("font-display leading-none tracking-wide", className)}>
      Blackthorn
      {!compact ? <span className="ml-1.5 text-muted">Scream Park</span> : null}
    </span>
  );
}
