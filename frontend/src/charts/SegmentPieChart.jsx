import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { SEGMENT_COLORS } from "@/utils/constants";
import {
  CHART_THEME,
  TOOLTIP_STYLE,
  ChartEmpty,
} from "./_shared";
import { formatNumber } from "@/utils/formatters";

/**
 * SegmentPieChart — donut of K-Means cluster shares.
 *
 * Real-data hardening over Phase 3:
 *   - Empty-state when v_segment_distribution returns nothing.
 *   - Stable fallback colour cycle for segment names outside the canonical
 *     four — defensive against future k != 4 runs.
 *   - Centre label adapts: if the percentages don't sum to 100 (rounding),
 *     we show the real sum; if they do, we show "100%".
 *   - Custom tooltip showing both raw customer count and percentage,
 *     because percent-only was the most-asked-for bit during viva rehearsals.
 */
const FALLBACK_PALETTE = [
  CHART_THEME.emerald,
  CHART_THEME.blue,
  CHART_THEME.purple,
  CHART_THEME.coral,
  CHART_THEME.amber,
  CHART_THEME.mint,
];

function colourFor(name, idx) {
  return SEGMENT_COLORS[name] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function SegmentTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {row.name}
      </div>
      <div className="mt-0.5 flex items-baseline justify-between gap-4 text-xs">
        <span className="text-muted-foreground">Customers</span>
        <span className="font-semibold">
          {row.customers != null ? formatNumber(row.customers, false) : "—"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span className="text-muted-foreground">Share</span>
        <span className="font-semibold">{row.value}%</span>
      </div>
    </div>
  );
}

export default function SegmentPieChart({ data, height = 220 }) {
  if (!data || data.length === 0) {
    return (
      <ChartEmpty
        height={height}
        message="No segments computed yet"
        hint="Run K-Means via scripts.run_ml_pipeline --only-kmeans --push-to-db."
      />
    );
  }

  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
            isAnimationActive
            animationDuration={550}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name ?? i} fill={colourFor(entry.name, i)} />
            ))}
          </Pie>
          <Tooltip content={<SegmentTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold tracking-tight">
          {Math.round(total)}%
        </div>
        <div className="text-xs text-muted-foreground">All segments</div>
      </div>
    </div>
  );
}
