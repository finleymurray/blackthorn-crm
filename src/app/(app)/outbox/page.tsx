import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Mail, MessageSquare } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listOutbox, outboxCounts, outboxParamsSchema, type OutboxParams } from "@/lib/data/outbox";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { OutboxFilters } from "./outbox-filters";

export const metadata: Metadata = { title: "Outbox" };

function toQuery(p: OutboxParams, overrides: Partial<OutboxParams> = {}) {
  const m = { ...p, ...overrides };
  const sp = new URLSearchParams();
  if (m.q) sp.set("q", m.q);
  if (m.channel !== "any") sp.set("channel", m.channel);
  if (m.source !== "any") sp.set("source", m.source);
  if (m.page > 1) sp.set("page", String(m.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function OutboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await requireStaff("/outbox");
  const raw = await searchParams;
  const parsed = outboxParamsSchema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const params = parsed.success ? parsed.data : outboxParamsSchema.parse({});
  const { rows, total, counts } = await withStaff(staff, async (db) => ({ ...(await listOutbox(db, params)), counts: await outboxCounts(db) }));

  return (
    <>
      <PageHeader title="Outbox" meta={`${formatNumber(counts.total)} messages · ${formatNumber(counts.today)} in the last 24 hours`} />
      <PageBody wide className="space-y-3">
        <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          <Inbox className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Demo outbox.</span> Every email and text the system “sends” lands here instead of a real inbox or phone. Open a message to see it exactly as the guest would.
          </p>
        </div>

        <OutboxFilters params={params} />

        {rows.length === 0 ? (
          <EmptyState icon={Inbox} title="No messages match" description="Send a campaign, run an automation or reply to a ticket and it will appear here." />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map((m) => {
                const Icon = m.channel === "email" ? Mail : MessageSquare;
                const source = m.campaign_name ? `Campaign · ${m.campaign_name}` : m.automation_name ? `Automation · ${m.automation_name}` : m.ticket_number ? `Ticket #${m.ticket_number}` : "Manual";
                return (
                  <li key={m.id}>
                    <Link href={`/outbox/${m.id}`} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3.5 py-2.5 hover:bg-white/[0.025] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:grid-cols-[auto_minmax(0,220px)_1fr_auto]">
                      <span className="mt-0.5 flex size-6 items-center justify-center rounded-md bg-white/[0.06] text-muted" aria-hidden>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">{m.recipient_name ?? m.recipient}</span>
                        <span className="block truncate text-[11px] text-muted">{m.recipient}</span>
                      </span>
                      <span className="col-span-3 min-w-0 pl-9 sm:col-span-1 sm:pl-0">
                        <span className="block truncate text-[13px]">{m.subject ?? m.body_text}</span>
                        <span className="block truncate text-[11px] text-muted">{source}</span>
                      </span>
                      <span className="col-start-3 row-start-1 flex flex-col items-end gap-1 sm:col-start-4">
                        <span className="tabular text-[11px] text-muted">{formatDateTime(m.sent_at)}</span>
                        <span className="flex gap-1">
                          {m.status === "test" ? <Badge>Test</Badge> : m.status === "simulated" ? <Badge variant="info">Simulated</Badge> : null}
                          {m.clicked_at ? (
                            <Badge variant="info" dot>
                              Clicked
                            </Badge>
                          ) : m.opened_at ? (
                            <Badge variant="success" dot>
                              Opened
                            </Badge>
                          ) : (
                            <Badge dot>Delivered</Badge>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Pagination page={params.page} per={params.per} total={total} makeHref={(p) => `/outbox${toQuery(params, { page: p })}`} />
          </>
        )}
      </PageBody>
    </>
  );
}
