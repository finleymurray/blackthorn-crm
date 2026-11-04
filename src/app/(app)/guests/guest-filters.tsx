"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GuestListParams } from "@/lib/data/guests";

type FilterKey = "email_consent" | "sms_consent" | "flag" | "tag" | "season" | "min_visits";

interface FilterDef {
  key: FilterKey;
  label: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * Attio-style filters: a search box, a "Filter" menu with nested options,
 * and the active filters as removable chips. State lives in the URL so the
 * server does the querying.
 */
export function GuestFilters({ params, tags, seasons }: { params: GuestListParams; tags: string[]; seasons: number[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState(params.q);
  const [pending, startTransition] = React.useTransition();

  const defs: FilterDef[] = [
    {
      key: "email_consent",
      label: "Email consent",
      options: [
        { value: "yes", label: "Opted in" },
        { value: "no", label: "Not opted in" },
      ],
    },
    {
      key: "sms_consent",
      label: "SMS consent",
      options: [
        { value: "yes", label: "Opted in" },
        { value: "no", label: "Not opted in" },
      ],
    },
    {
      key: "flag",
      label: "Flag",
      options: [
        { value: "accessibility", label: "Accessibility needs" },
        { value: "do_not_touch", label: "Do not touch" },
        { value: "banned", label: "Banned" },
      ],
    },
    { key: "tag", label: "Tag", options: tags.map((t) => ({ value: t, label: t })) },
    { key: "season", label: "Booked in", options: seasons.map((y) => ({ value: String(y), label: `Season ${y}` })) },
    {
      key: "min_visits",
      label: "Visits",
      options: [
        { value: "1", label: "1 or more" },
        { value: "2", label: "2 or more" },
        { value: "3", label: "3 or more" },
        { value: "5", label: "5 or more" },
      ],
    },
  ];

  const current: Record<FilterKey, string> = {
    email_consent: params.email_consent === "any" ? "" : params.email_consent,
    sms_consent: params.sms_consent === "any" ? "" : params.sms_consent,
    flag: params.flag === "any" ? "" : params.flag,
    tag: params.tag,
    season: params.season ? String(params.season) : "",
    min_visits: params.min_visits !== undefined ? String(params.min_visits) : "",
  };

  const navigate = React.useCallback(
    (next: Record<FilterKey, string>, query: string) => {
      const sp = new URLSearchParams();
      if (query.trim()) sp.set("q", query.trim());
      for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
      if (params.sort !== "last_visit") sp.set("sort", params.sort);
      if (params.dir !== "desc") sp.set("dir", params.dir);
      startTransition(() => router.push(`/guests${sp.size ? `?${sp}` : ""}`));
    },
    [params.sort, params.dir, router],
  );

  React.useEffect(() => {
    if (q === params.q) return;
    const t = window.setTimeout(() => navigate(current, q), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = defs.filter((d) => current[d.key]);

  return (
    <div className="toolbar" aria-busy={pending}>
      <div className="relative w-full sm:w-64">
        <label htmlFor="guest-q" className="sr-only">
          Search guests
        </label>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="guest-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, postcode, ref" className="pl-8" autoComplete="off" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" aria-label="Add filter">
            <ListFilter /> Filter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {defs.map((d) => (
            <DropdownMenuSub key={d.key}>
              <DropdownMenuSubTrigger>{d.label}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuRadioGroup value={current[d.key]} onValueChange={(v) => navigate({ ...current, [d.key]: v }, q)}>
                  {d.options.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted">Nothing to choose</p> : null}
                  {d.options.map((o) => (
                    <DropdownMenuRadioItem key={o.value} value={o.value}>
                      {o.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {active.map((d) => {
        const label = d.options.find((o) => o.value === current[d.key])?.label ?? current[d.key];
        return (
          <span key={d.key} className="inline-flex h-7 items-center gap-1 rounded-md bg-white/[0.06] pl-2 pr-1 text-xs">
            <span className="text-muted">{d.label}</span>
            <span className="text-foreground">{label}</span>
            <button
              type="button"
              onClick={() => navigate({ ...current, [d.key]: "" }, q)}
              className="ml-0.5 rounded-sm p-0.5 text-muted hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`Remove filter ${d.label}: ${label}`}
            >
              <X className="size-3" />
            </button>
          </span>
        );
      })}

      {active.length > 0 || params.q ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/guests")}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}
