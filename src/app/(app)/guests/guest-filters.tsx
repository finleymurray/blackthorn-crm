"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GuestListParams } from "@/lib/data/guests";

export function GuestFilters({ params, tags, seasons }: { params: GuestListParams; tags: string[]; seasons: number[] }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [q, setQ] = React.useState(params.q);
  const [pending, startTransition] = React.useTransition();

  const submit = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const sp = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      const s = String(v).trim();
      if (!s || s === "any") continue;
      sp.set(k, s);
    }
    if (params.sort !== "last_visit") sp.set("sort", params.sort);
    if (params.dir !== "desc") sp.set("dir", params.dir);
    startTransition(() => router.push(`/guests${sp.size ? `?${sp}` : ""}`));
  }, [params.sort, params.dir, router]);

  // Debounced search as you type.
  React.useEffect(() => {
    if (q === params.q) return;
    const t = window.setTimeout(submit, 300);
    return () => window.clearTimeout(t);
  }, [q, params.q, submit]);

  const hasFilters =
    params.q || params.email_consent !== "any" || params.sms_consent !== "any" || params.flag !== "any" || params.tag || params.season || params.min_visits !== undefined;

  return (
    <form
      ref={formRef}
      role="search"
      aria-label="Filter guests"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 lg:flex-row lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-busy={pending}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="guest-q">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            id="guest-q"
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone, postcode or booking ref"
            className="pl-9"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
        <div className="space-y-1">
          <Label htmlFor="f-email">Email consent</Label>
          <Select id="f-email" name="email_consent" defaultValue={params.email_consent} onChange={submit}>
            <option value="any">Any</option>
            <option value="yes">Opted in</option>
            <option value="no">Not opted in</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-sms">SMS consent</Label>
          <Select id="f-sms" name="sms_consent" defaultValue={params.sms_consent} onChange={submit}>
            <option value="any">Any</option>
            <option value="yes">Opted in</option>
            <option value="no">Not opted in</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-flag">Flag</Label>
          <Select id="f-flag" name="flag" defaultValue={params.flag} onChange={submit}>
            <option value="any">Any</option>
            <option value="accessibility">Accessibility needs</option>
            <option value="do_not_touch">Do not touch</option>
            <option value="banned">Banned</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-tag">Tag</Label>
          <Select id="f-tag" name="tag" defaultValue={params.tag} onChange={submit}>
            <option value="">Any</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-season">Booked in</Label>
          <Select id="f-season" name="season" defaultValue={params.season ? String(params.season) : ""} onChange={submit}>
            <option value="">Any season</option>
            {seasons.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-visits">Min visits</Label>
          <Select id="f-visits" name="min_visits" defaultValue={params.min_visits !== undefined ? String(params.min_visits) : ""} onChange={submit}>
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="5">5+</option>
          </Select>
        </div>
      </div>
      {hasFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/guests")} className="self-start lg:self-end">
          <X /> Clear
        </Button>
      ) : null}
    </form>
  );
}
