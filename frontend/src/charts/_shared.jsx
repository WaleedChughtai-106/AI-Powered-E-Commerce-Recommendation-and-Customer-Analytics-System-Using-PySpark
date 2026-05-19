import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/formatters";

/**
 * _shared — chart primitives reused across every Recharts component.
 *
 * Why this file
 * -------------
 * Phase 9's job is to make the dashboards survive *real* Olist data, which is
 * very different from the polite mock numbers Phase 3 was tuned for:
 *
 *   - Monetary values span 4+ orders of magnitude (a few BRL to ~10k BRL).
 *   - Many months have zero observations (Olist starts late 2016).
 *   - Some segments are nearly empty.
 *
 * That means every chart needs the same three pieces of plumbing:
 *
 *   1. ChartTooltip — a single styled Recharts <Tooltip> that formats values
 *      the same way the rest of the UI does (currency / number / percent),
 *      with a `nameMap` for renaming dataKeys ("actual" → "Actual revenue").
 *
 *   2. ChartEmpty — what a card shows when the live query returned an empty
 *      array. We *don't* want Recharts trying to render an empty SVG; that
 *      produces a confused 0-height frame and an axis-less ghost.
 *
 *   3. CHART_THEME — colour tokens. Charts used to hardcode hex literals, so
 *      a tweak to a brand colour meant editing every file. One source of
 *      truth means the visual style stays coherent.
 */

/* ─── Theme tokens ────────────────────────────────────────────────────────── */

export const CHART_THEME = {
  emerald:  "#10b981",
  mint:     "#34d399",
  neon:     "#6ee7b7",
  purple:   "#a78bfa",
  blue:     "#60a5fa",
  coral:    "#f87171",
  amber:    "#fbbf24",
  muted:    "#475569",
  /* Axis / grid colours route through CSS variables so the chart adapts
     when the user toggles between dark and light. SVG's `fill` and
     `stroke` attributes accept `var(--…)` directly. */
  axis:     "var(--text-secondary)",
  axisFaint:"var(--border-subtle)",
  grid:     "var(--grid-line)",
};

/* ─── Common Recharts style props ─────────────────────────────────────────── */

/** Standard tick style. Spread into every XAxis / YAxis tick prop. */
export const TICK_STYLE = { fill: "var(--text-secondary)", fontSize: 11 };

/** Standard contentStyle for any Recharts <Tooltip>. Reads from CSS variables
 *  so a theme switch re-skins every tooltip without a JS roundtrip. */
export const TOOLTIP_STYLE = {
  background: "var(--tooltip-bg)",
  border: "1px solid var(--tooltip-border)",
  borderRadius: 12,
  fontSize: 12,
  padding: "8px 12px",
  color: "var(--tooltip-text)",
  boxShadow: "0 8px 28px rgba(15,23,42,0.10), 0 0 0 1px var(--tooltip-border)",
  backdropFilter: "blur(12px)",
};

/* ─── Formatters ─────────────────────────────────────────────────────────── */

/**
 * Pick the right formatter for a given series name. Falls back to formatNumber.
 *
 *   "currency" → "$2.4M"        for revenue / monetary axes
 *   "number"   → "12,000"       for orders / counts
 *   "percent"  → "12.4%"        for shares / pcts
 *   "raw"      → as-is          for scores like RMSE / silhouette
 */
export function pickFormatter(kind = "number") {
  switch (kind) {
    case "currency": return (v) => formatCurrency(v);
    case "percent":  return (v) => formatPercent(Number(v), 1, false);
    case "raw":      return (v) => (v == null ? "—" : Number(v).toFixed(3));
    case "number":
    default:         return (v) => formatNumber(v);
  }
}

/** Axis-tick formatter — short labels, never the full "$1,240,000". */
export function compactAxisTick(v) {
  if (v == null) return "";
  if (Math.abs(v) >= 1000) return formatNumber(v);
  return String(v);
}

/** Currency-axis tick formatter — same as compact but always currency. */
export function compactCurrencyAxisTick(v) {
  return formatCurrency(v, "USD", true);
}

/* ─── Empty-state placeholder ─────────────────────────────────────────────── */

/**
 * Use inside any chart card when `data.length === 0`. Keeps the card height
 * stable so the page doesn't reflow when data eventually loads.
 */
export function ChartEmpty({
  height = 280,
  message = "No data to display",
  hint,
}) {
  return (
    <div
      className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015] px-6 text-center"
      style={{ height }}
    >
      <div className="text-sm font-semibold text-muted-foreground">{message}</div>
      {hint && (
        <div className="mt-1 max-w-[42ch] text-xs text-muted-foreground/70">{hint}</div>
      )}
    </div>
  );
}

/* ─── Custom tooltip ──────────────────────────────────────────────────────── */

/**
 * Drop-in replacement for Recharts' default <Tooltip>. Pass via the
 * `content={...}` prop, NOT instead of <Tooltip> itself — Recharts wires
 * cursor + position via the parent component.
 *
 * Props (when Recharts invokes us internally):
 *   active   : true when the cursor is over a chart element
 *   payload  : array of `{ name, value, dataKey, color, payload: row }`
 *   label    : the X-axis category for this hover
 *
 * Extra props (config you pass on the JSX):
 *   nameMap  : { dataKey: "Friendly Name" }
 *   format   : "currency" | "number" | "percent" | "raw" |
 *              { [dataKey]: "currency" | ... }
 *   labelFormatter : optional (label) => string
 *   footer   : optional small subline rendered below the rows
 */
export function ChartTooltip({
  active,
  payload,
  label,
  nameMap = {},
  format = "number",
  labelFormatter,
  footer,
}) {
  if (!active || !payload || payload.length === 0) return null;

  const labelOut = labelFormatter ? labelFormatter(label) : label;

  return (
    <div style={TOOLTIP_STYLE}>
      {labelOut != null && (
        <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {labelOut}
        </div>
      )}
      <ul className="space-y-0.5">
        {payload.map((row, i) => {
          if (row.value == null) return null;
          const key = row.dataKey ?? row.name ?? i;
          const kind =
            typeof format === "object" && format !== null
              ? (format[row.dataKey] ?? format[row.name] ?? "number")
              : format;
          const fmt = pickFormatter(kind);
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-4 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: row.color ?? CHART_THEME.emerald }}
                />
                {nameMap[row.dataKey] ?? nameMap[row.name] ?? row.name ?? row.dataKey}
              </span>
              <span className="font-semibold">{fmt(row.value)}</span>
            </li>
          );
        })}
      </ul>
      {footer && (
        <div className={cn("mt-2 border-t border-white/[0.06] pt-1.5 text-[10px] text-muted-foreground")}>
          {footer}
        </div>
      )}
    </div>
  );
}
