import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

/**
 * RadialMetric — compact circular gauge for ML model metrics.
 *
 * Real-data hardening over Phase 3:
 *   - Accepts any 0..`max` value, not just 0..100. RMSE is unbounded; the
 *     mlInsightsService projects it onto 0..100 by clipping, and we display
 *     the *raw* value via the new `label` prop so the centre reads
 *     "rmse=42.7" instead of a misleading "42%".
 *   - Null-safe: an empty/NaN value renders an empty ring rather than
 *     crashing Recharts.
 *   - ARIA-labelled wrapper so screen readers announce the metric.
 */
export default function RadialMetric({
  value,
  color = "#10b981",
  size = 80,
  max = 100,
  label,         // optional override for the centre text, e.g. "0.36" for silhouette
  ariaLabel,     // optional accessible label, e.g. "ALS RMSE"
}) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const data = [{ name: "metric", value: safeValue }];
  const display = label != null ? label : `${safeValue}%`;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
    >
      <ResponsiveContainer>
        <RadialBarChart
          innerRadius="78%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            fill={color}
            background={{ fill: "rgba(255,255,255,0.06)" }}
            isAnimationActive
            animationDuration={550}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
        {display}
      </div>
    </div>
  );
}
