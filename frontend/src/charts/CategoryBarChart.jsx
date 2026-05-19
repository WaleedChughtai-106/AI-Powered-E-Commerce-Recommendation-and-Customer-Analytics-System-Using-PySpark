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
  TOOLTIP_STYLE,
} from "./_shared";
import { formatCurrency, formatNumber } from "@/utils/formatters";

/**
 * CategoryBarChart — horizontal revenue-by-category bars.
 *
 * Real-data hardening over Phase 3:
 *   - Empty-state when v_category_performance returns no rows.
 *   - Bar colour reflects avg review score (the only "quality of category"
 *     signal Olist provides), not a fake margin:
 *         score >= 4.3   → emerald  (excellent)
 *         score >= 3.7   → blue     (solid)
 *         else           → coral    (concerning)
 *   - Truncates long Portuguese category names (e.g. *fashion_roupa_masculina*)
 *     at 24 chars in the Y-axis so they don't blow the layout.
 *   - Tooltip shows real revenue + a star line ("★ 4.32") for review score.
 */

function colourForScore(score) {
  if (score == null) return CHART_THEME.muted;
  const s = Number(score);
  if (s >= 4.3) return CHART_THEME.emerald;
  if (s >= 3.7) return CHART_THEME.blue;
  return CHART_THEME.coral;
}

function CategoryTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {row.category}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 text-xs">
        <span className="text-muted-foreground">Revenue</span>
        <span className="font-semibold">{formatCurrency(row.revenue ?? 0)}</span>
      </div>
      {row.unitsSold != null && (
        <div className="flex items-baseline justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Units sold</span>
          <span className="font-semibold">{formatNumber(row.unitsSold)}</span>
        </div>
      )}
      {row.reviewScore != null && (
        <div className="flex items-baseline justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Avg review</span>
          <span className="font-semibold">★ {Number(row.reviewScore).toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function truncate(label, n = 24) {
  if (!label) return "";
  return label.length > n ? `${label.slice(0, n - 1)}…` : label;
}

export default function CategoryBarChart({ data, height = 300 }) {
  if (!data || data.length === 0) {
    return (
      <ChartEmpty
        height={height}
        message="No category performance yet"
        hint="The v_category_performance view aggregates from order_items + product_category_translation."
      />
    );
  }

  // Recharts renders Y-axis labels as-is — pre-truncate to keep the chart tidy.
  const adjusted = data.map((d) => ({
    ...d,
    categoryShort: truncate(d.category, 24),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={adjusted}
        layout="vertical"
        margin={{ top: 5, right: 10, bottom: 5, left: 30 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.04)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={compactCurrencyAxisTick}
        />
        <YAxis
          dataKey="categoryShort"
          type="category"
          tick={{ fill: "#e2e8f0", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: "rgba(16,185,129,0.06)" }}
          content={<CategoryTooltip />}
        />
        <Bar
          dataKey="revenue"
          radius={[0, 8, 8, 0]}
          isAnimationActive
          animationDuration={550}
        >
          {adjusted.map((entry, i) => (
            <Cell
              key={i}
              fill={colourForScore(entry.reviewScore ?? entry.margin / 12)}
              opacity={0.88}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
