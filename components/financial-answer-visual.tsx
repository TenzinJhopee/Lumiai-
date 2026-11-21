"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { formatMoney } from "@/lib/finance";
import { financialChartColors } from "@/lib/financial-visualization";
import type { FinancialChart, FinancialVisualization } from "@/lib/financial-visualization";

function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean;
  payload?: { color?: string; name?: string; value?: number | string }[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#15141c] px-3 py-2.5 shadow-lg">
      {label && <p className="mb-1.5 text-xs font-semibold text-white/60">{label}</p>}
      {payload.map((item) => (
        <p className="flex items-center gap-2 text-xs leading-5 text-white/85" key={item.name}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}: <strong>{formatMoney(Number(item.value ?? 0), currency)}</strong>
        </p>
      ))}
    </div>
  );
}

function Chart({ chart, currency }: { chart: FinancialChart; currency: string }) {
  if (chart.type === "pie") {
    return (
      <>
        <div aria-label={`${chart.title} chart`} className="h-48 w-full" role="img">
          <ResponsiveContainer height="100%" width="100%">
            <PieChart>
              <Pie data={chart.points} dataKey="value" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={3} stroke="none">
                {chart.points.map((point, index) => (
                  <Cell fill={financialChartColors[index % financialChartColors.length]} key={point.label} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {chart.points.map((point, index) => (
            <li className="flex min-w-0 items-center gap-2 text-[11px] text-white/65" key={point.label}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: financialChartColors[index % financialChartColors.length] }} />
              <span className="min-w-0 flex-1 truncate">{point.label}</span>
              <strong className="shrink-0 text-white/85">{formatMoney(Number(point.value), currency)}</strong>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div aria-label={`${chart.title} chart`} className="h-[220px] w-full" role="img">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={chart.points} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="#ffffff18" />
          <XAxis axisLine={false} domain={["auto", "auto"]} tick={{ fill: "#a9a4b8", fontSize: 10 }} tickFormatter={(value: number) => formatMoney(value, currency, true)} tickLine={false} type="number" />
          <YAxis axisLine={false} dataKey="label" tick={{ fill: "#d0cbd9", fontSize: 10 }} tickLine={false} type="category" width={104} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          {chart.series.length > 1 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ color: "#c5bfd0", fontSize: 10 }} />}
          {chart.series.map((series) => (
            <Bar dataKey={series.key} fill={series.color} key={series.key} name={series.label} radius={4} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinancialAnswerVisual({ currency, visualization }: {
  currency: string;
  visualization: FinancialVisualization;
}) {
  return (
    <section aria-label={`${visualization.title} statistics`} className="mt-3 rounded-xl border border-violet-200/10 bg-black/20 p-3 sm:p-4">
      <h3 className="text-xs font-semibold text-white/85">{visualization.title}</h3>
      {visualization.stats.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visualization.stats.map((stat) => (
            <div className="min-w-0 rounded-lg border border-white/5 bg-white/[0.03] p-2.5" key={stat.label}>
              <dt className="truncate text-[10px] text-white/50">{stat.label}</dt>
              <dd className="mt-1 truncate text-sm font-semibold text-white/90">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {visualization.chart && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <h4 className="mb-2 text-[11px] font-medium text-white/70">{visualization.chart.title}</h4>
          <Chart chart={visualization.chart} currency={currency} />
          {visualization.chart.note && <p className="mt-2 text-[10px] leading-4 text-white/45">{visualization.chart.note}</p>}
        </div>
      )}
      {visualization.note && <p className="mt-2 text-[10px] leading-4 text-white/45">{visualization.note}</p>}
    </section>
  );
}
