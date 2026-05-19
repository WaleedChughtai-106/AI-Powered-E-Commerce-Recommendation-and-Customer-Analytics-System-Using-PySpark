import { cn } from "@/lib/utils";

/**
 * LoadingSkeleton — animated placeholder bars used while a Supabase fetch is
 * in flight. Keeps card heights stable so the page doesn't reflow when the
 * real data lands.
 *
 * Props
 *   variant : "card"  — pulsing rectangle (default)
 *             "kpi"   — KPI card shape (label + value + sparkline-ish bar)
 *             "table" — N row skeleton at a given column count
 *             "chart" — wide pulsing block, height-matched to the chart
 *
 *   rows    : number of rows (table) or items (other variants). default 1
 *   height  : px override for "chart"/"card" — defaults match the real chart heights
 *   columns : "table" only
 */
export default function LoadingSkeleton({
  variant = "card",
  rows = 1,
  columns = 4,
  height,
  className,
}) {
  if (variant === "kpi") {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: rows || 4 }).map((_, i) => (
          <div key={i} className={cn("glass-card p-5", className)}>
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.07]" />
            <div className="mt-5 flex items-end justify-between">
              <div className="h-7 w-28 animate-pulse rounded bg-white/[0.10]" />
              <div className="h-3 w-10 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div
        className={cn("animate-pulse rounded-lg bg-white/[0.04]", className)}
        style={{ height: height ?? 280 }}
      />
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-3">
            {Array.from({ length: columns }).map((__, j) => (
              <div
                key={j}
                className="h-4 flex-1 animate-pulse rounded bg-white/[0.05]"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // "card" default
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-white/[0.04]",
        className
      )}
      style={{ height: height ?? 120 }}
    />
  );
}
