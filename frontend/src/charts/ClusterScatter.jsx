import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { SEGMENT_COLORS } from "@/utils/constants";
import {
  CHART_THEME,
  TICK_STYLE,
  TOOLTIP_STYLE,
  ChartEmpty,
} from "./_shared";
import { formatCurrency, formatNumber } from "@/utils/formatters";

/**
 * ClusterScatter — one point per customer.
 *   X = purchase frequency
 *   Y = total monetary (BRL on real Olist)
 *
 * Real-data hardening over Phase 3:
 *   - Empty state.
 *   - Monetary on real Olist spans 4 orders of magnitude (a few BRL → 13k+).
 *     A linear Y-axis squashes every typical customer into the bottom 10% of
 *     the plot. We auto-switch to a log scale when the max/min ratio is wide
 *     (> 100) and the minimum is positive. Linear stays the default when the
 *     range is well-behaved so the viva audience doesn't have to read logs.
 *   - Custom tooltip with currency-formatted monetary + plain frequency,
 *     plus the segment_label so the dot they're hovering is actually labelled.
 *   - Stable colour fallback for unknown segment names.
 */

const FALLBACK_PALETTE = [
  CHART_THEME.emerald,
  CHART_THEME.blue,
  CHART_THEME.purple,
  CHART_THEME.coral,
  CHART_THEME.amber,
];

function colourFor(name, idx) {
  return SEGMENT_COLORS[name] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function ScatterTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {row.cluster ?? "Customer"}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 text-xs">
        <span className="text-muted-foreground">Frequency</span>
        <span className="font-semibold">{formatNumber(row.frequency, false)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4 text-xs">
        <span className="text-muted-foreground">Monetary</span>
        <span className="font-semibold">{formatCurrency(row.monetary)}</span>
      </div>
    </div>
  );
}

export default function ClusterScatter({ data, height = 320 }) {
  if (!data || data.length === 0) {
    return (
      <ChartEmpty
        height={height}
        message="No clustered customers yet"
        hint="Run K-Means and refresh: scripts.run_ml_pipeline --only-kmeans --push-to-db."
      />
    );
  }

  // Decide whether to log-scale the monetary axis.
  const monetaryValues = data.map((p) => Number(p.monetary)).filter(
    (v) => Number.isFinite(v) && v > 0
  );
  let useLog = false;
  if (monetaryValues.length > 4) {
    const max = Math.max(...monetaryValues);
    const min = Math.min(...monetaryValues);
    useLog = max / min > 100;
  }

  const grouped = data.reduce((acc, p) => {
    const key = p.cluster ?? "Unknown";
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" />
        <XAxis
          type="number"
          dataKey="frequency"
          name="Frequency"
          tick={TICK_STYLE}
          axisLine={{ stroke: CHART_THEME.axisFaint }}
          tickLine={false}
          label={{
            value: "Purchase frequency",
            position: "insideBottom",
            offset: -2,
            fill: "#64748b",
            fontSize: 11,
          }}
        />
        <YAxis
          type="number"
          dataKey="monetary"
          name="Monetary"
          scale={useLog ? "log" : "linear"}
          domain={useLog ? ["auto", "auto"] : [0, "auto"]}
          allowDataOverflow={false}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v, "USD", true)}
          width={64}
          label={{
            value: useLog ? "Monetary (log)" : "Monetary",
            angle: -90,
            position: "insideLeft",
            offset: 10,
            fill: "#64748b",
            fontSize: 11,
          }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.1)" }}
          content={<ScatterTooltip />}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: CHART_THEME.axis }}
          iconType="circle"
        />
        {Object.entries(grouped).map(([name, points], i) => (
          <Scatter
            key={name}
            name={name}
            data={points}
            fill={colourFor(name, i)}
            fillOpacity={0.78}
            isAnimationActive
            animationDuration={600}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
