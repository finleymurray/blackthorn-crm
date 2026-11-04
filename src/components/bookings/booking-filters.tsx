"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BookingListParams, NightSummary } from "@/lib/data/bookings";
import { formatDateOnly } from "@/lib/format";

export function BookingFilters({ params, nights }: { params: BookingListParams; nights: NightSummary[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState(params.q);
  const push = React.useCallback(
    (next: Partial<BookingListParams>) => {
      const m = { ...params, ...next, page: 1 };
      const sp = new URLSearchParams();
      if (m.q) sp.set("q", m.q);
      if (m.status !== "all") sp.set("status", m.status);
      if (m.ticket_type) sp.set("ticket_type", m.ticket_type);
      if (m.night) sp.set("night", m.night);
      if (m.season) sp.set("season", String(m.season));
      if (m.when !== "all") sp.set("when", m.when);
      if (m.sort !== "night") sp.set("sort", m.sort);
      if (m.dir !== "desc") sp.set("dir", m.dir);
      router.push(`/bookings${sp.size ? `?${sp}` : ""}`);
    },
    [params, router],
  );
  React.useEffect(() => {
    if (q === params.q) return;
    const t = window.setTimeout(() => push({ q }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const sel = "h-8 w-auto text-xs";
  const active = params.q || params.status !== "all" || params.ticket_type || params.night || params.season || params.when !== "all";
  const seasons = [...new Set(nights.map((n) => n.season_year))];
  return (
    <div className="toolbar" role="search" aria-label="Filter bookings">
      <div className="relative w-full sm:w-64">
        <label htmlFor="bk-q" className="sr-only">Search bookings</label>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="bk-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, guest name or email" className="pl-8" autoComplete="off" />
      </div>
      <label htmlFor="bk-when" className="sr-only">When</label>
      <Select id="bk-when" value={params.when} onChange={(e) => push({ when: e.target.value as BookingListParams["when"] })} className={sel}>
        <option value="all">All dates</option>
        <option value="upcoming">Upcoming</option>
        <option value="past">Past</option>
      </Select>
      <label htmlFor="bk-night" className="sr-only">Night</label>
      <Select id="bk-night" value={params.night} onChange={(e) => push({ night: e.target.value })} className={sel}>
        <option value="">Any night</option>
        {nights.map((n) => (
          <option key={n.id} value={n.id}>
            {formatDateOnly(n.date)} · {n.booked}/{n.capacity}{n.status === "cancelled" ? " · cancelled" : ""}
          </option>
        ))}
      </Select>
      <label htmlFor="bk-season" className="sr-only">Season</label>
      <Select id="bk-season" value={params.season ? String(params.season) : ""} onChange={(e) => push({ season: e.target.value ? Number(e.target.value) : undefined })} className={sel}>
        <option value="">Any season</option>
        {seasons.map((y) => (
          <option key={y} value={y}>Season {y}</option>
        ))}
      </Select>
      <label htmlFor="bk-status" className="sr-only">Status</label>
      <Select id="bk-status" value={params.status} onChange={(e) => push({ status: e.target.value as BookingListParams["status"] })} className={sel}>
        <option value="all">Any status</option>
        <option value="confirmed">Confirmed</option>
        <option value="transferred">Moved</option>
        <option value="no_show">No show</option>
        <option value="refunded">Refunded</option>
      </Select>
      <label htmlFor="bk-type" className="sr-only">Ticket type</label>
      <Select id="bk-type" value={params.ticket_type} onChange={(e) => push({ ticket_type: e.target.value as BookingListParams["ticket_type"] })} className={sel}>
        <option value="">Any ticket type</option>
        <option value="standard">Standard</option>
        <option value="fast_track">Fast Track</option>
        <option value="vip">VIP</option>
        <option value="group">Group (10+)</option>
      </Select>
      {active ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/bookings")}>Clear all</Button>
      ) : null}
    </div>
  );
}
