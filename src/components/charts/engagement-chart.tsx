"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, tooltipStyle } from "./theme";
import { formatNumber } from "@/lib/format";

export function EngagementChart({ data }: { data: Array<{ hour: string; opens: number; clicks: number }> }) {
  if (data.every((d) => d.opens === 0 && d.clicks === 0)) {
    return <div className="flex h-[220px] items-center justify-center text-xs text-muted">No engagement recorded yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="opens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.15} />
            <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="clicks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.secondary} stopOpacity={0.15} />
            <stop offset="100%" stopColor={CHART.secondary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="hour" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={7} />
        <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={{ stroke: CHART.grid }} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} formatter={(v, name) => [formatNumber(Number(v)), name === "opens" ? "Opens" : "Clicks"]} />
        <Area type="monotone" dataKey="opens" stroke={CHART.primary} strokeWidth={1.5} fill="url(#opens)" isAnimationActive={false} />
        <Area type="monotone" dataKey="clicks" stroke={CHART.secondary} strokeWidth={1.5} fill="url(#clicks)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
