import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  CHART_THEME,
  TICK_STYLE,
  compactCurrencyAxisTick,
  ChartEmpty,
  ChartTooltip,
} from "./_shared";

/**
 * RevenueBarChart — last 7 days. The bar with the maximum revenue is
 * highlighted in `neon`; the rest fade to `emerald` at 55% opacity so the
 * winner reads from a glance.
 *
 * Real-data hardening over Phase 3:
 *   - Empty state when v_revenue_daily_7d returns nothing (Olist's most
 *     recent date may simply not have a 7-day window populated).
 *   - All-zeros guard so we don't highlight every bar when revenue is flat.
 *   - Tie-tolerant max: if two days tie for top, both light up. That's still
 *     informative and avoids an arbitrary winner.
 *   - Currency-formatted tooltip.
 */
export default function RevenueBarChart({ data, height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <ChartEmpty
        height={height}
        message="No daily revenue in the last 7 days"
        hint="The v_revenue_daily_7d view depends on recent orders. Re-run preprocessing if the source data was just loaded."
      />
    );
  }

  const max = Math.max(...data.map((d) => Number(d.revenue ?? 0)));
  const allZero = max <= 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
        <XAxis
          dataKey="day"
          tick={TICK_STYLE}
          axisLine={{ stroke: CHART_THEME.axisFaint }}
          tickLine={false}
        />
        <YAxis
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={compactCurrencyAxisTick}
          width={64}
        />
        <Tooltip
          cursor={{ fill: "rgba(16,185,129,0.07)" }}
          content={
            <ChartTooltip
              format="currency"
              nameMap={{ revenue: "Revenue" }}
            />
          }
        />
        <Bar
          dataKey="revenue"
          radius={[6, 6, 0, 0]}
          isAnimationActive
          animationDuration={550}
        >
          {data.map((entry, i) => {
            const isMax = !allZero && Number(entry.revenue) === max;
            return (
              <Cell
                key={i}
                fill={isMax ? CHART_THEME.neon : CHART_THEME.emerald}
                opacity={isMax ? 1 : 0.55}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
