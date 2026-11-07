"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import type { OutboxParams } from "@/lib/data/outbox";

export function OutboxFilters({ params }: { params: OutboxParams }) {
  const router = useRouter();
  const [q, setQ] = React.useState(params.q);
  const [channel, setChannel] = React.useState(params.channel);
  const [source, setSource] = React.useState(params.source);

  React.useEffect(() => {
    if (q === params.q && channel === params.channel && source === params.source) return;
    const t = window.setTimeout(() => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (channel !== "any") sp.set("channel", channel);
      if (source !== "any") sp.set("source", source);
      router.push(`/outbox${sp.size ? `?${sp}` : ""}`);
    }, q !== params.q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [q, channel, source, params.q, params.channel, params.source, router]);

  return (
    <div className="toolbar" role="search" aria-label="Filter outbox">
      <div className="relative w-full sm:w-64">
        <label htmlFor="outbox-q" className="sr-only">
          Search recipient or subject
        </label>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="outbox-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recipient, email, phone or subject" className="pl-8" />
      </div>
      <label htmlFor="outbox-channel" className="sr-only">
        Channel
      </label>
      <Select id="outbox-channel" value={channel} onChange={(e) => setChannel(e.target.value as OutboxParams["channel"])} className="h-8 w-auto text-[13px]">
        <option value="any">All channels</option>
        <option value="email">Email</option>
        <option value="sms">SMS</option>
      </Select>
      <label htmlFor="outbox-source" className="sr-only">
        Source
      </label>
      <Select id="outbox-source" value={source} onChange={(e) => setSource(e.target.value as OutboxParams["source"])} className="h-8 w-auto text-[13px]">
        <option value="any">All sources</option>
        <option value="campaign">Campaigns</option>
        <option value="automation">Automations</option>
        <option value="ticket">Support replies</option>
        <option value="test">Test sends</option>
      </Select>
    </div>
  );
}
