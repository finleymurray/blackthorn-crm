import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Mail, MessageSquare } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import { getCampaign, getCampaignReport } from "@/lib/data/campaigns";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EngagementChart } from "@/components/charts/engagement-chart";
import { EXCLUSION_LABELS, type ExclusionReason } from "@/lib/segments/consent";
import { duplicateCampaignAction } from "../../actions";
import { canManageMarketing } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Campaign report" };

export default async function CampaignReportPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("/campaigns");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await withStaff(staff, async (db) => {
    const campaign = await getCampaign(db, id);
    if (!campaign || campaign.status !== "sent") return null;
    return { campaign, report: await getCampaignReport(db, campaign) };
  });
  if (!data) notFound();
  const { campaign: c, report } = data;
  const Icon = c.channel === "email" ? Mail : MessageSquare;
  const rate = (n: number) => (report.recipients ? formatPercent(n / report.recipients, 1) : "–");
  const duplicate = duplicateCampaignAction.bind(null, c.id);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Campaigns", href: "/campaigns" }]}
        title={c.name}
        meta={`Sent ${formatDateTime(c.sent_at)}`}
        actions={
          canManageMarketing(staff.role) ? (
            <form action={duplicate}>
              <Button type="submit" variant="secondary" size="sm">
                <Copy /> Duplicate as new draft
              </Button>
            </form>
          ) : null
        }
      />
      <PageBody wide className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge dot variant="success">
            Sent
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Icon className="size-3.5" aria-hidden /> {c.channel === "email" ? "Email" : "SMS"}
          </span>
          <span>·</span>
          <span>
            Segment: {c.segment_id ? <Link href={`/segments/${c.segment_id}`} className="text-foreground hover:underline">{c.segment_name}</Link> : "deleted"}
          </span>
          {c.channel === "email" ? (
            <>
              <span>·</span>
              <span className="truncate">Subject: “{c.subject}”</span>
            </>
          ) : null}
        </div>

        <section aria-label="Results" className="stat-strip grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <p className="stat-label">Audience</p>
            <p className="stat-value">{formatNumber(c.stats.audience ?? report.recipients)}</p>
            <p className="stat-sub">in segment at send time</p>
          </div>
          <div>
            <p className="stat-label">Recipients</p>
            <p className="stat-value">{formatNumber(report.recipients)}</p>
            <p className="stat-sub">{formatNumber(c.stats.excluded ?? 0)} excluded</p>
          </div>
          <div>
            <p className="stat-label">Opens</p>
            <p className="stat-value">{rate(report.opens)}</p>
            <p className="stat-sub">{formatNumber(report.opens)} guests</p>
          </div>
          <div>
            <p className="stat-label">Clicks</p>
            <p className="stat-value">{rate(report.clicks)}</p>
            <p className="stat-sub">{formatNumber(report.clicks)} guests</p>
          </div>
          <div>
            <p className="stat-label">Bookings after</p>
            <p className="stat-value">{formatNumber(report.bookings_after)}</p>
            <p className="stat-sub">by recipients within 14 days</p>
          </div>
          <div>
            <p className="stat-label">Revenue after</p>
            <p className="stat-value">{formatMoney(report.revenue_after_pence, { compact: true })}</p>
            <p className="stat-sub">from those bookings</p>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              actions={
                <span className="flex items-center gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-[2px] bg-[#c2636b]" aria-hidden /> Opens
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-[2px] bg-[#4a8fd8]" aria-hidden /> Clicks
                  </span>
                </span>
              }
            >
              <CardTitle>Engagement over 48 hours</CardTitle>
              <CardDescription>Simulated opens and clicks per hour after sending</CardDescription>
            </CardHeader>
            <CardContent>
              <EngagementChart data={report.timeline} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Who was excluded</CardTitle>
              <CardDescription>Consent is enforced at send time</CardDescription>
            </CardHeader>
            <CardContent>
              {c.stats.excluded ? (
                <ul className="space-y-1.5 text-xs">
                  {Object.entries(c.stats.excluded_reasons ?? {}).map(([reason, n]) => (
                    <li key={reason} className="flex justify-between">
                      <span className="text-muted">{EXCLUSION_LABELS[reason as ExclusionReason] ?? reason}</span>
                      <span className="tabular">{formatNumber(n)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">Everyone in the segment could be contacted.</p>
              )}
              <p className="mt-4 text-[11px] leading-snug text-muted">Every message sent is listed in the outbox. Opens and clicks are simulated for the demo; a real provider would post them back via webhook.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader actions={<Link href={`/outbox?source=campaign&q=${encodeURIComponent(c.subject ?? c.name)}`} className="text-xs text-muted hover:text-foreground">Open in outbox</Link>}>
            <CardTitle>Most engaged recipients</CardTitle>
            <CardDescription>Guests who clicked or opened first</CardDescription>
          </CardHeader>
          <Table flush>
            <TableHeader>
              <TableRow>
                <TableHead>Guest</TableHead>
                <TableHead className="hidden sm:table-cell">Sent to</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Clicked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.sample.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={m.recipient_name ?? m.recipient} size="sm" />
                      {m.guest_id ? (
                        <Link href={`/guests/${m.guest_id}`} className="hover:underline">
                          {m.recipient_name}
                        </Link>
                      ) : (
                        m.recipient_name
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-strong">{m.recipient}</TableCell>
                  <TableCell className="tabular text-muted-strong">{m.opened_at ? formatDateTime(m.opened_at) : <span className="text-muted">–</span>}</TableCell>
                  <TableCell className="tabular text-muted-strong">{m.clicked_at ? formatDateTime(m.clicked_at) : <span className="text-muted">–</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  );
}
