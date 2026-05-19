import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  CHART_THEME,
  TICK_STYLE,
  compactCurrencyAxisTick,
  ChartEmpty,
  ChartTooltip,
} from "./_shared";

/**
 * RevenueAreaChart — actual revenue vs forecast, one point per month.
 *
 * Real-data hardening over the Phase 3 mock version:
 *   - Empty-state placeholder (instead of a 0-height ghost SVG) when the
 *     12-month Supabase query comes back empty.
 *   - Dashed "predicted" series is hidden when the forecast isn't actually
 *     populated (dashboardService falls back to predicted=actual to keep
 *     the legend stable; we detect that here and skip rendering the line).
 *   - Tooltip uses the shared currency-formatting component so $1,240,000
 *     renders as "$1.2M" the same way the KPI cards do.
 */
export default function RevenueAreaChart({ data, height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <ChartEmpty
        height={height}
        message="No revenue trend yet"
        hint="Run scripts.seed_supabase to populate v_revenue_monthly, then refresh."
      />
    );
  }

  // Forecast was populated only if at least one row's predicted differs from actual.
  const hasForecast = data.some(
    (d) => d.predicted != null && Number(d.predicted) !== Number(d.actual ?? 0)
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="rev-actual-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_THEME.emerald} stopOpacity={0.4} />
            <stop offset="100%" stopColor={CHART_THEME.emerald} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rev-pred-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_THEME.purple} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_THEME.purple} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
        <XAxis
          dataKey="month"
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
          content={
            <ChartTooltip
              format="currency"
              nameMap={{ actual: "Actual revenue", predicted: "Forecast" }}
            />
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: CHART_THEME.axis }}
          iconType="circle"
        />
        <Area
          type="monotone"
          dataKey="actual"
          stroke={CHART_THEME.emerald}
          strokeWidth={2}
          fill="url(#rev-actual-grad)"
          name="Actual"
          isAnimationActive
          animationDuration={650}
        />
        {hasForecast && (
          <Area
            type="monotone"
            dataKey="predicted"
            stroke={CHART_THEME.purple}
            strokeDasharray="4 4"
            strokeWidth={2}
            fill="url(#rev-pred-grad)"
            name="Predicted"
            isAnimationActive
            animationDuration={650}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
