import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Megaphone, MessageSquare, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { listCampaigns } from "@/lib/data/campaigns";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Campaigns" };

const statusBadge = { draft: "default", scheduled: "info", sent: "success" } as const;

export default async function CampaignsPage() {
  const staff = await requireStaff("/campaigns");
  const campaigns = await withStaff(staff, listCampaigns);

  return (
    <>
      <PageHeader
        title="Campaigns"
        meta={`${campaigns.length} total`}
        actions={
          <Button asChild size="sm">
            <Link href="/campaigns/new">
              <Plus /> New campaign
            </Link>
          </Button>
        }
      />
      <PageBody wide>
        {campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns yet" description="Pick a segment, write an email or text, and send it to the demo outbox." action={<Button asChild size="sm"><Link href="/campaigns/new">Create a campaign</Link></Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Segment</TableHead>
                <TableHead className="text-right">Sent to</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Opens</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Clicks</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Bookings after</TableHead>
                <TableHead className="hidden lg:table-cell">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => {
                const Icon = c.channel === "email" ? Mail : MessageSquare;
                const r = c.stats.recipients ?? 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-6 items-center justify-center rounded-md bg-white/[0.06] text-muted" aria-hidden>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <Link href={c.status === "sent" ? `/campaigns/${c.id}/report` : `/campaigns/${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                          <div className="truncate text-xs text-muted">{c.channel === "email" ? c.subject : c.sms_body}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[c.status]} dot>
                        {c.status === "sent" ? "Sent" : c.status === "scheduled" ? "Scheduled" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-strong">{c.segment_name ?? <span className="text-muted">No segment</span>}</TableCell>
                    <TableCell className="tabular text-right">{c.status === "sent" ? formatNumber(r) : <span className="text-muted">–</span>}</TableCell>
                    <TableCell className="hidden sm:table-cell tabular text-right">{c.status === "sent" && r ? formatPercent((c.stats.opens ?? 0) / r) : <span className="text-muted">–</span>}</TableCell>
                    <TableCell className="hidden sm:table-cell tabular text-right">{c.status === "sent" && r ? formatPercent((c.stats.clicks ?? 0) / r) : <span className="text-muted">–</span>}</TableCell>
                    <TableCell className="hidden lg:table-cell tabular text-right">{c.status === "sent" ? formatNumber(c.stats.bookings_after ?? 0) : <span className="text-muted">–</span>}</TableCell>
                    <TableCell className="hidden lg:table-cell tabular text-muted-strong">
                      {c.status === "sent" ? formatDateTime(c.sent_at) : c.status === "scheduled" ? formatDateTime(c.scheduled_for) : `edited ${formatDateTime(c.updated_at)}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </PageBody>
    </>
  );
}
