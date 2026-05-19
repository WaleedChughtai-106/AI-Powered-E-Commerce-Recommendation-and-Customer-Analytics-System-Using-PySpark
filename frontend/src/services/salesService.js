import { supabase } from "./supabaseClient";
import { fetchRevenueMonthly, fetchRevenueMonthlyWithForecast } from "./dashboardService";

/**
 * salesService — fetches for the Sales Analytics page.
 *
 * Reuses the dashboard's `fetchRevenueMonthly[WithForecast]` (same view,
 * same shape) and adds:
 *   - fetchChannelPerformance   → v_channel_performance
 *   - fetchCategoryPerformance  → v_category_performance
 */

function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Channel performance (right-hand list)                               */
/* ------------------------------------------------------------------ */

/**
 * Olist's "channel" is the payment_type proxy that v_channel_performance
 * surfaces. Returns `[{ channel, value, change }]` for the right-hand list
 * on the Sales page.
 *
 * `change` is not a real period-over-period delta — Olist's snapshot is
 * static, so we synthesise a deterministic "share of total" pseudo-change.
 * (Documented in PHASE_8_FRONTEND.md.)
 */
const CHANNEL_LABEL = {
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  boleto: "Boleto",
  voucher: "Voucher",
  not_defined: "Other",
};

export async function fetchChannelPerformance() {
  const rows = unwrap(
    await supabase
      .from("v_channel_performance")
      .select("channel, revenue, order_count, pct_of_total")
      .order("revenue", { ascending: false })
  );

  return rows.map((r) => {
    const channelKey = String(r.channel ?? "not_defined").toLowerCase();
    return {
      channel: CHANNEL_LABEL[channelKey] ?? titleCase(channelKey),
      value: Number(r.revenue ?? 0),
      // Display the share-of-total as `change` so the bar fills proportionally.
      change: Number(r.pct_of_total ?? 0),
      orderCount: Number(r.order_count ?? 0),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Category performance (heat-tiles + bar chart)                       */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ category, revenue, margin }]` for CategoryBarChart and the
 * grid view on SalesAnalyticsPage.
 *
 * Olist has no margin column — `avg_review_score` (1–5) is the only
 * quality-of-product proxy the dataset provides. We map it onto a 0–60%
 * pseudo-margin so the bar chart's colour band (green ≥ 30, blue ≥ 15,
 * coral < 15) still distinguishes the rows. Documented in
 * PHASE_8_FRONTEND.md as a known cosmetic substitute, not a real metric.
 */
export async function fetchCategoryPerformance(limit = 12) {
  const rows = unwrap(
    await supabase
      .from("v_category_performance")
      .select("category, revenue, order_count, units_sold, avg_review_score")
      .order("revenue", { ascending: false })
      .limit(limit)
  );

  return rows.map((r) => ({
    category: titleCase(r.category),
    revenue: Number(r.revenue ?? 0),
    // avg_review_score is 1..5; map to a 0..60% pseudo-margin band.
    margin: r.avg_review_score != null
      ? Math.round(Number(r.avg_review_score) * 12)
      : 0,
    orderCount: Number(r.order_count ?? 0),
    unitsSold: Number(r.units_sold ?? 0),
    reviewScore: r.avg_review_score != null ? Number(r.avg_review_score) : null,
  }));
}

/* Re-exports so the page imports stay short. */
export { fetchRevenueMonthly, fetchRevenueMonthlyWithForecast };


/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function titleCase(s) {
  if (!s) return "—";
  return String(s)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
