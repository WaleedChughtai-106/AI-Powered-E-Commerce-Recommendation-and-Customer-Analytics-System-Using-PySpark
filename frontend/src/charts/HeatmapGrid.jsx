import { ChartEmpty } from "./_shared";

/**
 * HeatmapGrid — 24 hours × 7 days activity intensity (0..1 per cell).
 *
 * Real-data hardening over Phase 3:
 *   - Empty state when the live query (Visualization Center fetches recent
 *     `orders.order_purchase_timestamp` and buckets by hour × DoW) hasn't
 *     returned a single row.
 *   - Accessible per-cell `title` showing the actual count when it's
 *     available (the `count` prop is optional; falls back to "intensity").
 *   - Slightly denser hour ticks (every 2 hours instead of every 3) so the
 *     real-data heatmap, which has a strong evening band, reads cleanly.
 *   - Uses the same emerald accent the rest of the dashboard does — a
 *     single source of truth would be tidier but Tailwind utilities don't
 *     accept dynamic `rgba()` opacities, so we stay inline.
 *
 * The component is intentionally NOT a Recharts wrapper. A CSS-grid heatmap
 * is faster, smaller, and easier to make accessible for a 24×7 cell matrix.
 */
export default function HeatmapGrid({ data, height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <ChartEmpty
        height={height}
        message="No order-activity data yet"
        hint="Heatmap reads recent rows from public.orders. Push raw tables to Supabase first."
      />
    );
  }

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Build a fast (hour, day) → row lookup so we don't .find() inside the render.
  const lookup = new Map();
  for (const row of data) {
    lookup.set(`${row.hour}|${row.day}`, row);
  }
  const cellFor = (h, d) => lookup.get(`${h}|${d}`);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour header */}
        <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 mb-1">
          <div />
          {hours.map((h) => (
            <div
              key={h}
              className="text-[9px] text-muted-foreground text-center"
              aria-hidden="true"
            >
              {h % 2 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>

        {/* Rows */}
        {days.map((d) => (
          <div
            key={d}
            className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 mb-1"
          >
            <div className="text-[11px] text-muted-foreground flex items-center">
              {d}
            </div>
            {hours.map((h) => {
              const row = cellFor(h, d);
              const v = Number(row?.value ?? 0);
              const opacity = 0.06 + Math.min(1, Math.max(0, v)) * 0.7;
              const count = row?.count;
              const title =
                count != null
                  ? `${d} ${h}:00 — ${count} order${count === 1 ? "" : "s"}`
                  : `${d} ${h}:00 — intensity ${(v * 100).toFixed(0)}%`;
              return (
                <div
                  key={h}
                  className="h-6 rounded-[3px] transition hover:ring-1 hover:ring-emerald-400"
                  style={{ background: `rgba(16, 185, 129, ${opacity})` }}
                  title={title}
                  role="img"
                  aria-label={title}
                />
              );
            })}
          </div>
        ))}

        {/* Scale legend */}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          Low
          <div className="flex gap-0.5">
            {[0.1, 0.25, 0.45, 0.65, 0.85].map((o) => (
              <div
                key={o}
                className="h-3 w-6 rounded-sm"
                style={{ background: `rgba(16, 185, 129, ${o})` }}
              />
            ))}
          </div>
          High
        </div>
      </div>
    </div>
  );
}
