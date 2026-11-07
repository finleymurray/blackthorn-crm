import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
import { formatLongDate, formatMoney, formatNumber, formatRelative } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { BookingsPerNightChart, RevenueByTicketTypeChart, SurveyByMazeChart, TicketsByCategoryChart } from "@/components/charts/dashboard-charts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

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

  const stats: Array<{ label: string; value: string; sub: string; href?: string; tone?: "warning" }> = [
    { label: "Guests on file", value: formatNumber(kpis.total_guests), sub: "all seasons", href: "/guests" },
    { label: "Bookings this season", value: formatNumber(kpis.bookings_this_season), sub: "excluding refunds", href: `/guests?season=${kpis.season_year}` },
    { label: "Net revenue", value: formatMoney(kpis.revenue_this_season_pence), sub: kpis.season_name },
    { label: "Repeat guests", value: `${kpis.repeat_guest_pct.toFixed(0)}%`, sub: "of guests who have visited", href: "/guests?min_visits=2" },
    {
      label: "Open tickets",
      value: formatNumber(kpis.open_tickets),
      sub: kpis.overdue_tickets > 0 ? `${formatNumber(kpis.overdue_tickets)} past SLA` : "all within SLA",
      href: "/support",
      tone: kpis.overdue_tickets > 0 ? "warning" : undefined,
    },
    { label: "Survey score", value: kpis.avg_survey_score ? `${kpis.avg_survey_score.toFixed(1)}` : "–", sub: "average out of 10" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" meta={`${kpis.season_name} · ${formatLongDate(new Date())}`} />
      <PageBody className="space-y-8">
        {denied ? (
          <p role="alert" className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
            Your role does not have access to that area.
          </p>
        ) : null}

        <section aria-label="Key figures" className="stat-strip grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {stats.map((s) => {
            const inner = (
              <>
                <p className="stat-label">{s.label}</p>
                <p className={cn("stat-value", s.tone === "warning" && "text-warning")}>{s.value}</p>
                <p className="stat-sub">{s.sub}</p>
              </>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                {inner}
              </Link>
            ) : (
              <div key={s.label}>{inner}</div>
            );
          })}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Bookings per night</CardTitle>
              <CardDescription>{kpis.season_name}, confirmed bookings</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingsPerNightChart data={data.nights} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              actions={
                kpis.overdue_tickets > 0 ? (
                  <Link href="/support?overdue=1" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-foreground">
                    All overdue <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                ) : null
              }
            >
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Overdue tickets and low survey scores</CardDescription>
            </CardHeader>
            {data.attention.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">Nothing needs attention right now.</p>
            ) : (
              <ul className="py-2">
                {data.attention.slice(0, 6).map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href} className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.025] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <span className={cn("mt-[7px] size-2 shrink-0 rounded-full", item.severity === "danger" ? "bg-danger" : "bg-warning")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{item.title}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted">
                          {item.kind === "overdue" ? "Overdue" : item.kind === "complaint" ? "Complaint" : "Low score"} · {item.subtitle}
                        </span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-xs tabular text-muted">{formatRelative(item.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
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
              <CardDescription>Average out of 10, all seasons</CardDescription>
            </CardHeader>
            <CardContent>
              <SurveyByMazeChart data={data.mazes} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              actions={
                <span className="flex items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-[2px] bg-white/[0.12]" aria-hidden /> All time
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-[2px] bg-[#c2636b]" aria-hidden /> Open
                  </span>
                </span>
              }
            >
              <CardTitle>Tickets by category</CardTitle>
              <CardDescription>Open now against all time</CardDescription>
            </CardHeader>
            <CardContent>
              <TicketsByCategoryChart data={data.categories} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
