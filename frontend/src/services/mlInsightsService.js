import { supabase } from "./supabaseClient";
import { fetchRevenueMonthlyWithForecast } from "./dashboardService";
import { fetchSegmentDistribution } from "./dashboardService";

/**
 * mlInsightsService — fetches for the AI Insights / ML page.
 *
 * Source tables/views:
 *   v_ml_model_latest     → MODEL_METRICS card row (silhouette, RMSE, etc.)
 *   sales_forecasts       → forecast bounds for the prediction card
 *   v_revenue_monthly     → historical line behind the forecast chart
 *   v_segment_distribution→ K-Means cluster density grid
 */

function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

/**
 * Returns `[{ name, value, change, color }]` for the four radial metric cards.
 *
 * v_ml_model_latest gives us the most-recent (model_name, metric_name) pair.
 * We translate Spark's MLlib metric names into a human-friendly label and
 * project the raw metric onto a 0..100 visual scale so the existing
 * RadialMetric component (which expects a percentage) still reads correctly.
 *
 *   silhouette [-1..1]      → display as percent in [0..100]
 *   precision_at_k [0..1]   → already a fraction; ×100
 *   rmse                    → "raw" (no fixed bound), reported as-is in label
 *                              and clipped to 100 for the radial fill
 *   r2 [0..1 usually]       → ×100
 */
const METRIC_DISPLAY = {
  kmeans__silhouette:      { name: "K-Means Silhouette",   color: "emerald" },
  als__rmse:               { name: "ALS RMSE",             color: "blue" },
  als__precision_at_k:     { name: "ALS Precision@K",      color: "emerald" },
  sales_forecast__rmse:    { name: "Forecast RMSE",        color: "coral" },
  sales_forecast__r2:      { name: "Forecast R²",          color: "emerald" },
};

function projectToPercent(modelName, metricName, raw) {
  const v = Number(raw);
  if (Number.isNaN(v)) return 0;
  if (metricName === "silhouette")       return Math.round(Math.max(-1, Math.min(1, v)) * 50 + 50);
  if (metricName === "precision_at_k")   return Math.round(Math.max(0, Math.min(1, v)) * 100);
  if (metricName === "r2")               return Math.round(Math.max(0, Math.min(1, v)) * 100);
  if (metricName === "rmse")             return Math.max(0, Math.min(100, Math.round(v))); // crude clip — radial fill only
  return Math.max(0, Math.min(100, Math.round(v)));
}

export async function fetchModelMetrics() {
  const rows = unwrap(
    await supabase
      .from("v_ml_model_latest")
      .select("model_name, metric_name, metric_value, params, trained_at")
      .order("trained_at", { ascending: false })
  );

  if (rows.length === 0) return [];

  // Deduplicate (model, metric) keeping the most recent — v_ml_model_latest
  // already does DISTINCT ON, but a defensive dedup costs nothing.
  const seen = new Set();
  const out  = [];
  for (const r of rows) {
    const key = `${r.model_name}__${r.metric_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const display = METRIC_DISPLAY[key] ?? {
      name:  titleCase(`${r.model_name} ${r.metric_name}`),
      color: "blue",
    };
    out.push({
      name:  display.name,
      value: projectToPercent(r.model_name, r.metric_name, r.metric_value),
      raw:   Number(r.metric_value),
      change: 0,                  // historical comparison not stored — Phase 11
      color: display.color,
      model: r.model_name,
      metric: r.metric_name,
      trainedAt: r.trained_at,
    });
  }

  // Pin the order so the page reads K-Means → ALS → Forecast left-to-right.
  const priority = [
    "kmeans__silhouette",
    "als__precision_at_k",
    "als__rmse",
    "sales_forecast__r2",
    "sales_forecast__rmse",
  ];
  out.sort((a, b) => {
    const ai = priority.indexOf(`${a.model}__${a.metric}`);
    const bi = priority.indexOf(`${b.model}__${b.metric}`);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return out.slice(0, 4);
}

/**
 * Returns `{ lower, upper, predictedTotal, model }` for the forecast hero card.
 * Sums the next 30 forecast days for a single "expected revenue" number.
 */
export async function fetchForecastSummary() {
  const rows = unwrap(
    await supabase
      .from("sales_forecasts")
      .select("forecast_date, predicted_revenue, lower_bound, upper_bound, model_name")
      .order("forecast_date", { ascending: true })
  );
  if (rows.length === 0) {
    return { lower: null, upper: null, predictedTotal: null, model: null, n: 0 };
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.predicted += Number(r.predicted_revenue ?? 0);
      acc.lower     += Number(r.lower_bound ?? r.predicted_revenue ?? 0);
      acc.upper     += Number(r.upper_bound ?? r.predicted_revenue ?? 0);
      return acc;
    },
    { predicted: 0, lower: 0, upper: 0 }
  );

  return {
    predictedTotal: totals.predicted,
    lower: totals.lower,
    upper: totals.upper,
    model: rows[0].model_name,
    n: rows.length,
  };
}

/* Re-exports so the page imports stay short. */
export { fetchRevenueMonthlyWithForecast, fetchSegmentDistribution };


/* ------------------------------------------------------------------ */
function titleCase(s) {
  if (!s) return "—";
  return String(s)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
