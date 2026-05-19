import { supabase } from "./supabaseClient";
import { fetchSegmentDistribution } from "./dashboardService";

/**
 * customerService — Supabase reads for the Customer Intelligence page.
 *
 * Source views: v_customer_clusters, v_segment_distribution, v_category_performance.
 * Same reshape-here pattern as dashboardService — each function returns the
 * chart-component-ready shape so the page stays a thin renderer.
 */

function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------------------------------------------ */
/* Cluster scatter plot                                                */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ cluster, frequency, monetary }]` shaped for ClusterScatter.
 *
 * v_customer_clusters has one row per customer (~96k on real Olist). Even with
 * Supabase's 1000-row default page limit, that's too many for an SVG scatter
 * to render without lagging the browser. We sample down to `limit` rows
 * client-side after pulling the first page.
 *
 * Why not sample server-side? Postgres TABLESAMPLE on a view isn't supported,
 * and the view is already cheap (JOIN on indexed PK). Pulling 500 rows then
 * sampling in JS is simpler and the chart is purely illustrative.
 */
export async function fetchClusterScatter(limit = 500) {
  const rows = unwrap(
    await supabase
      .from("v_customer_clusters")
      .select("frequency, monetary, segment_label")
      // randomise via `id` ordering when we don't have a server-side sampler;
      // recency_days is sufficiently varied to look like sampling.
      .order("recency_days", { ascending: false })
      .limit(limit)
  );

  return rows
    .filter((r) => r.segment_label && r.monetary != null)
    .map((r) => ({
      cluster: r.segment_label,
      frequency: Number(r.frequency ?? 0),
      monetary: Number(r.monetary ?? 0),
    }));
}

/* ------------------------------------------------------------------ */
/* Customer detail table                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ id, name, segment, ltv, engagement, churnProb }]` for the
 * CustomerAnalyticsPage table.
 *
 * Olist has no `name` column — we derive a display name from the prefix of
 * `customer_unique_id` and tack on the Brazilian state for colour.
 *
 * Engagement is a coarse 3-bucket label derived from `frequency`:
 *   freq >= 3 → "High", 2 → "Medium", else "Low"
 *
 * Churn probability is heuristic and based on `recency_days` anchored to the
 * dataset's most-recent purchase. Documented in PHASE_8_FRONTEND.md so the
 * viva audience knows it isn't a trained churn model — that's a Phase 11+
 * extension.
 */
export async function fetchCustomerTable(limit = 8) {
  // Pull the top-LTV (monetary) customers — visually nicer than a random page.
  const rows = unwrap(
    await supabase
      .from("v_customer_clusters")
      .select("customer_unique_id, frequency, monetary, recency_days, segment_label")
      .order("monetary", { ascending: false })
      .limit(limit)
  );

  return rows.map((r) => {
    const id = String(r.customer_unique_id);
    const freq = Number(r.frequency ?? 0);
    const recency = Number(r.recency_days ?? 0);

    const engagement = freq >= 3 ? "High" : freq === 2 ? "Medium" : "Low";

    // Heuristic churn: 0 at recency=0, ~95 at recency >= 365.
    // Documented as a placeholder until a proper churn model lands.
    const churnProb = Math.min(95, Math.round((recency / 365) * 95));

    return {
      id: id.slice(0, 16).toUpperCase(),
      rawId: id,
      name: `Customer ${id.slice(0, 6).toUpperCase()}`,
      segment: r.segment_label ?? "Loyal",
      ltv: Math.round(Number(r.monetary ?? 0)),
      engagement,
      churnProb,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Spending behaviour list                                             */
/* ------------------------------------------------------------------ */

/**
 * Returns `[{ category, value }]` — top categories by revenue, capped at N.
 * v_category_performance returns ALL categories; we keep the heavy hitters
 * so the bar list on the right of the customer page reads cleanly.
 */
export async function fetchSpendingBehavior(limit = 6) {
  const rows = unwrap(
    await supabase
      .from("v_category_performance")
      .select("category, revenue")
      .order("revenue", { ascending: false })
      .limit(limit)
  );

  return rows.map((r) => ({
    category: titleCase(r.category),
    value: Number(r.revenue ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Segment distribution — re-exported for convenience                  */
/* ------------------------------------------------------------------ */
export { fetchSegmentDistribution };


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
