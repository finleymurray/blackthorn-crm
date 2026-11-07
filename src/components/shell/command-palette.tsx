"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Search, Loader2, User, Ticket, LifeBuoy, CornerDownLeft } from "lucide-react";
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

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();

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
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  const go = (hit: SearchHit) => {
    onOpenChange(false);
    setQuery("");
    setHits([]);
    router.push(hit.href);
  };

  const showList = query.trim().length >= 2;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setQuery("");
          setHits([]);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          className="overlay fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            {loading ? <Loader2 className="size-4 animate-spin text-muted" aria-hidden /> : <Search className="size-4 text-muted" aria-hidden />}
            <input
              autoFocus
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
              aria-label="Search guests, bookings and tickets"
              placeholder="Search guests, bookings, tickets…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) {
                  setHits([]);
                  setLoading(false);
                }
              }}
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
                }
              }}
              className="h-12 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted"
            />
            <kbd className="rounded-[3px] bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
          </div>
          <div id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-1.5">
            {!showList ? (
              <p className="px-2.5 py-6 text-center text-[13px] text-muted">Type a name, email, phone, postcode, booking reference or ticket number.</p>
            ) : loading && hits.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-[13px] text-muted">Searching…</p>
            ) : hits.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-[13px] text-muted">No matches for “{query.trim()}”.</p>
            ) : (
              <ul>
                {hits.map((hit, i) => {
                  const Icon = ICONS[hit.type];
                  return (
                    <li
                      key={`${hit.type}-${hit.id}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(hit)}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2", i === active && "bg-white/[0.06]")}
                    >
                      <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{hit.title}</span>
                        <span className="block truncate text-xs text-muted">{hit.subtitle}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">{LABELS[hit.type]}</span>
                      {i === active ? <CornerDownLeft className="size-3 shrink-0 text-muted" aria-hidden /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
