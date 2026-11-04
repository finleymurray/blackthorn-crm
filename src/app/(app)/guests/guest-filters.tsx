"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
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

  React.useEffect(() => {
    if (q === params.q) return;
    const t = window.setTimeout(submit, 300);
    return () => window.clearTimeout(t);
  }, [q, params.q, submit]);

  const hasFilters =
    params.q || params.email_consent !== "any" || params.sms_consent !== "any" || params.flag !== "any" || params.tag || params.season || params.min_visits !== undefined;

  const selectClass = "h-8 w-auto min-w-[8.5rem] text-xs";

  return (
    <form
      ref={formRef}
      role="search"
      aria-label="Filter guests"
      className="toolbar"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      aria-busy={pending}
    >
      <div className="relative w-full sm:w-72">
        <label htmlFor="guest-q" className="sr-only">
          Search guests
        </label>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="guest-q" name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone, postcode or booking ref" className="pl-8" autoComplete="off" />
      </div>
      <label htmlFor="f-email" className="sr-only">
        Email consent
      </label>
      <Select id="f-email" name="email_consent" defaultValue={params.email_consent} onChange={submit} className={selectClass}>
        <option value="any">Email consent: any</option>
        <option value="yes">Email: opted in</option>
        <option value="no">Email: not opted in</option>
      </Select>
      <label htmlFor="f-sms" className="sr-only">
        SMS consent
      </label>
      <Select id="f-sms" name="sms_consent" defaultValue={params.sms_consent} onChange={submit} className={selectClass}>
        <option value="any">SMS consent: any</option>
        <option value="yes">SMS: opted in</option>
        <option value="no">SMS: not opted in</option>
      </Select>
      <label htmlFor="f-flag" className="sr-only">
        Flag
      </label>
      <Select id="f-flag" name="flag" defaultValue={params.flag} onChange={submit} className={selectClass}>
        <option value="any">Flag: any</option>
        <option value="accessibility">Accessibility needs</option>
        <option value="do_not_touch">Do not touch</option>
        <option value="banned">Banned</option>
      </Select>
      <label htmlFor="f-tag" className="sr-only">
        Tag
      </label>
      <Select id="f-tag" name="tag" defaultValue={params.tag} onChange={submit} className={selectClass}>
        <option value="">Tag: any</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <label htmlFor="f-season" className="sr-only">
        Booked in season
      </label>
      <Select id="f-season" name="season" defaultValue={params.season ? String(params.season) : ""} onChange={submit} className={selectClass}>
        <option value="">Booked in: any season</option>
        {seasons.map((y) => (
          <option key={y} value={y}>
            Booked in {y}
          </option>
        ))}
      </Select>
      <label htmlFor="f-visits" className="sr-only">
        Minimum visits
      </label>
      <Select id="f-visits" name="min_visits" defaultValue={params.min_visits !== undefined ? String(params.min_visits) : ""} onChange={submit} className={selectClass}>
        <option value="">Visits: any</option>
        <option value="1">1 or more visits</option>
        <option value="2">2 or more visits</option>
        <option value="3">3 or more visits</option>
        <option value="5">5 or more visits</option>
      </Select>
      {hasFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/guests")}>
          <X /> Clear
        </Button>
      ) : null}
    </form>
  );
}
