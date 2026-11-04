import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, MessageSquareWarning, Star } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { withStaff } from "@/lib/db/client";
import {
  getBookingsPerNight,
  getDashboardKpis,
  getNeedsAttention,
  getRevenueByTicketType,
  getSurveyScoreByMaze,
  getTicketsByCategory,
} from "@/lib/data/dashboard";
import { formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingsPerNightChart, RevenueByTicketTypeChart, SurveyByMazeChart, TicketsByCategoryChart } from "@/components/charts/dashboard-charts";
import { cn } from "@/lib/utils";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaff("/");
  const { denied } = await searchParams;

  const data = await withStaff(staff, async (db) => {
    const [kpis, nights, revenue, mazes, categories, attention] = await Promise.all([
      getDashboardKpis(db),
      getBookingsPerNight(db),
      getRevenueByTicketType(db),
      getSurveyScoreByMaze(db),
      getTicketsByCategory(db),
      getNeedsAttention(db),
    ]);
    return { kpis, nights, revenue, mazes, categories, attention };
  });
  const { kpis } = data;

  const kpiCards = [
    { label: "Total guests", value: formatNumber(kpis.total_guests), sub: "all time", href: "/guests" },
    { label: `Bookings · ${kpis.season_name}`, value: formatNumber(kpis.bookings_this_season), sub: "excluding refunds", href: "/guests?season=" + kpis.season_year },
    { label: `Revenue · ${kpis.season_name}`, value: formatMoney(kpis.revenue_this_season_pence, { compact: true }), sub: formatMoney(kpis.revenue_this_season_pence), href: null },
    { label: "Repeat guests", value: `${kpis.repeat_guest_pct.toFixed(0)}%`, sub: "of guests who have visited", href: "/guests?min_visits=2" },
    {
      label: "Open support tickets",
      value: formatNumber(kpis.open_tickets),
      sub: kpis.overdue_tickets > 0 ? `${formatNumber(kpis.overdue_tickets)} past SLA` : "all within SLA",
      href: "/support",
      warn: kpis.overdue_tickets > 0,
    },
    { label: "Average survey score", value: kpis.avg_survey_score ? `${kpis.avg_survey_score.toFixed(1)} / 10` : "–", sub: kpis.season_name, href: null },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting()}, ${staff.name.split(" ")[0]}`} description={`Here's how ${kpis.season_name} is going.`} />

      {denied ? (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
          Your role does not have access to that area.
        </p>
      ) : null}

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map((k) => {
          const inner = (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{k.label}</p>
              <p className={cn("tabular mt-2 text-2xl font-semibold", k.warn && "text-warning")}>{k.value}</p>
              <p className="mt-1 text-xs text-muted">{k.sub}</p>
            </>
          );
          return k.href ? (
            <Link
              key={k.label}
              href={k.href}
              className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
            >
              {inner}
            </Link>
          ) : (
            <div key={k.label} className="rounded-lg border border-border bg-surface p-4">
              {inner}
            </div>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid gap-4 lg:grid-cols-2 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Bookings per night</CardTitle>
              <CardDescription>{kpis.season_name}, confirmed bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingsPerNightChart data={data.nights} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue by ticket type</CardTitle>
              <CardDescription>{kpis.season_name}, net of refunds</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueByTicketTypeChart data={data.revenue} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Survey score by maze</CardTitle>
              <CardDescription>Average of guest ratings, all seasons</CardDescription>
            </CardHeader>
            <CardContent>
              <SurveyByMazeChart data={data.mazes} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Support tickets by category</CardTitle>
              <CardDescription>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-[#3a3a48]" aria-hidden /> All time
                </span>
                <span className="ml-3 inline-flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-sm bg-[#cf5d66]" aria-hidden /> Open now
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TicketsByCategoryChart data={data.categories} />
            </CardContent>
          </Card>
        </div>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Overdue tickets, open complaints and low survey scores</CardDescription>
          </CardHeader>
          <CardContent>
            {data.attention.length === 0 ? (
              <EmptyState title="All clear" description="Nothing is overdue and no low scores have come in this week." className="py-8" />
            ) : (
              <ul className="divide-y divide-border">
                {data.attention.map((item) => {
                  const Icon = item.kind === "overdue" ? Clock : item.kind === "complaint" ? MessageSquareWarning : Star;
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link href={item.href} className="group flex items-start gap-3 py-3 focus-visible:outline-2 focus-visible:outline-ring">
                        <span
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                            item.severity === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium group-hover:underline">{item.title}</span>
                          <span className="block truncate text-xs text-muted">{item.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <Badge variant={item.severity === "danger" ? "danger" : "warning"} className="mb-1">
                            {item.kind === "overdue" ? "Overdue" : item.kind === "complaint" ? "Complaint" : "Low score"}
                          </Badge>
                          <span className="block text-[11px] text-muted">{formatRelative(item.at)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {kpis.overdue_tickets > 0 ? (
              <Link href="/support?overdue=1" className="mt-3 inline-flex items-center gap-1 text-sm text-muted-strong hover:text-foreground">
                <AlertTriangle className="size-3.5" aria-hidden /> View all {kpis.overdue_tickets} overdue tickets{" "}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
