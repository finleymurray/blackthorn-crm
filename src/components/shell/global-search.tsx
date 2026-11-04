"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, Ticket, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchHit {
  type: "guest" | "booking" | "ticket";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const ICONS = { guest: User, booking: Ticket, ticket: LifeBuoy } as const;
const LABELS = { guest: "Guest", booking: "Booking", ticket: "Ticket" } as const;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setHits([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  };

  const showList = open && query.trim().length >= 2;

  return (
    <div className="relative w-full max-w-xl" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <label htmlFor="global-search" className="sr-only">
        Search guests, bookings and tickets
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id="global-search"
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
          placeholder="Search guests, bookings, tickets…"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value.trim().length < 2) {
              setHits([]);
              setLoading(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-16 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted sm:block">
          Ctrl K
        </kbd>
      </div>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-border bg-surface-raised shadow-2xl"
        >
          {loading && hits.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
            </div>
          ) : hits.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted">No matches for “{query.trim()}”</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {hits.map((hit, i) => {
                const Icon = ICONS[hit.type];
                return (
                  <li
                    key={`${hit.type}-${hit.id}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(hit)}
                    onMouseEnter={() => setActive(i)}
                    className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", i === active && "bg-border/60")}
                  >
                    <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{hit.title}</p>
                      <p className="truncate text-xs text-muted">{hit.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">{LABELS[hit.type]}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
