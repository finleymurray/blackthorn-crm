"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipStyle } from "./theme";
import { formatMoney, formatNumber } from "@/lib/format";
import { TICKET_TYPE_LABELS, type TicketTypeKey } from "@/lib/domain/constants";
import type { CategoryCount, MazeScore, NightPoint, TicketTypeRevenue } from "@/lib/data/dashboard";

const axisProps = { tick: { fill: CHART.axis, fontSize: 12 }, axisLine: { stroke: "rgba(255,255,255,0.08)" }, tickLine: false as const };

function ddmm(date: string) {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function BookingsPerNightChart({ data }: { data: NightPoint[] }) {
  if (data.length === 0) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="date" tickFormatter={ddmm} interval="preserveStartEnd" minTickGap={18} {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) => [formatNumber(Number(value)), name === "bookings" ? "Bookings" : "Guests"]}
          labelFormatter={(label) => `Night of ${String(label).split("-").reverse().join("/")}`}
        />
        <Bar dataKey="bookings" name="bookings" fill={CHART.primary} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueByTicketTypeChart({ data }: { data: TicketTypeRevenue[] }) {
  if (data.length === 0) return <ChartEmpty />;
  const rows = data.map((d) => ({ ...d, label: TICKET_TYPE_LABELS[d.ticket_type as TicketTypeKey] ?? d.ticket_type }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" tickFormatter={(v) => formatMoney(Number(v), { compact: true })} {...axisProps} />
        <YAxis type="category" dataKey="label" width={86} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(value) => [formatMoney(Number(value)), "Revenue"]} />
        <Bar dataKey="revenue_pence" fill={CHART.primary} radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false} label={{ position: "right", fill: CHART.text, fontSize: 12, formatter: (v: unknown) => formatMoney(Number(v), { compact: true }) }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SurveyByMazeChart({ data }: { data: MazeScore[] }) {
  if (data.length === 0) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} {...axisProps} />
        <YAxis type="category" dataKey="maze" width={112} {...axisProps} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, _n, item) => [`${Number(value).toFixed(1)} / 10 from ${formatNumber((item.payload as MazeScore).responses)} responses`, "Average score"]}
        />
        <Bar dataKey="avg_score" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false} label={{ position: "right", fill: CHART.text, fontSize: 12, formatter: (v: unknown) => Number(v).toFixed(1) }}>
          {data.map((d) => (
            <Cell key={d.slug} fill={d.avg_score < 6 ? CHART.secondary : CHART.primary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TicketsByCategoryChart({ data }: { data: CategoryCount[] }) {
  if (data.length === 0) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }} barCategoryGap={8} barGap={2}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis type="category" dataKey="label" width={112} {...axisProps} />
        <Tooltip {...tooltipStyle} formatter={(value, name) => [formatNumber(Number(value)), name === "total" ? "All time" : "Open now"]} />
        <Bar dataKey="total" name="total" fill={CHART.muted} radius={[0, 3, 3, 0]} maxBarSize={12} isAnimationActive={false} />
        <Bar dataKey="open" name="open" fill={CHART.primary} radius={[0, 3, 3, 0]} maxBarSize={12} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartEmpty() {
  return <div className="flex h-[240px] items-center justify-center text-sm text-muted">No data yet</div>;
}
