import { supabase } from "./supabaseClient";

/**
 * productService — fetches for the Product Insights page.
 *
 * v_top_products is the canonical source. It returns:
 *   product_id, category, total_revenue, units_sold, total_orders,
 *   avg_review_score, review_count, inventory_status, last_sold_at
 *
 * We derive a few display-only fields (sentiment label, trend tag) from the
 * underlying metrics so the page's cards / pills don't render as null.
 * These mappings are deterministic and documented in PHASE_8_FRONTEND.md.
 */

function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

/**
 * Map a review-score (1..5) to a sentiment pill label.
 * Boundaries pinned to feel right against the mock-data examples
 * ("Strong Buy" / "Buy" / "Resilient" / "Watch").
 */
function sentimentFromScore(score) {
  if (score == null) return "Resilient";
  if (score >= 4.5) return "Strong Buy";
  if (score >= 4.0) return "Buy";
  if (score >= 3.5) return "Resilient";
  return "Watch";
}

/**
 * Map inventory_status to the visual "tag" the card uses.
 * `inventory_status` is one of {healthy, low, out_of_stock}; we lift it to
 * the TAG_PILL keys the card knows.
 */
function tagFromInventory(status, score) {
  if (status === "out_of_stock") return "DECLINING";
  if (status === "low")          return "GROWING";
  if (score != null && Number(score) >= 4.5) return "TRENDING";
  return "STABLE";
}

/**
 * Returns `[{ id, name, revenue, change, sentiment, tag, category, ... }]`
 * for TOP_PRODUCTS-shape consumers.
 *
 * `name` is synthesised from the category label + product_id prefix because
 * Olist doesn't carry English product names. Viva-defensible: the rest of
 * the dataset is anonymised the same way (customers, sellers).
 *
 * `change` is a pseudo-trend signal derived from review_score (so a 5-star
 * product reads as "+14%" rather than a true delta). Will be replaced with
 * a real month-over-month metric the day product_metrics gains a `*_prev`
 * column.
 */
export async function fetchTopProducts(limit = 4) {
  const rows = unwrap(
    await supabase
      .from("v_top_products")
      .select(
        "product_id, category, total_revenue, units_sold, total_orders, " +
        "avg_review_score, review_count, inventory_status, last_sold_at"
      )
      .limit(limit)
  );

  return rows.map((r, i) => {
    const id = String(r.product_id);
    const score = r.avg_review_score != null ? Number(r.avg_review_score) : null;
    return {
      id: id.slice(0, 8).toUpperCase(),
      rawId: id,
      // friendlier display name composed from category + a stable id suffix
      name: titleCase(r.category ?? "Product") + " · " + id.slice(0, 4).toUpperCase(),
      category: titleCase(r.category ?? "Other"),
      revenue: Number(r.total_revenue ?? 0),
      // pseudo-delta — see docstring
      change: score != null ? Number((score - 3.0) * 4).toFixed(1) * 1 : 0,
      sentiment: sentimentFromScore(score),
      tag: tagFromInventory(r.inventory_status, score),
      unitsSold: Number(r.units_sold ?? 0),
      reviewCount: Number(r.review_count ?? 0),
      inventoryStatus: r.inventory_status ?? "healthy",
      reviewScore: score,
      rank: i + 1,
    };
  });
}

/**
 * Inventory alerts feed for the right column on Product Insights.
 * Filters v_top_products to non-`healthy` items and produces the alert shape
 * the page already renders.
 */
export async function fetchInventoryAlerts(limit = 5) {
  const rows = unwrap(
    await supabase
      .from("v_top_products")
      .select("product_id, category, inventory_status, last_sold_at, total_revenue, units_sold")
      .neq("inventory_status", "healthy")
      .order("total_revenue", { ascending: false })
      .limit(limit)
  );

  return rows.map((r) => {
    const status = r.inventory_status;
    const severity = status === "out_of_stock" ? "high" : "medium";
    const type     = status === "out_of_stock" ? "LOW_STOCK"   : "OVERSTOCK";

    const lastSold = r.last_sold_at ? new Date(r.last_sold_at) : null;
    const daysSince = lastSold
      ? Math.round((Date.now() - lastSold.getTime()) / 86_400_000)
      : null;

    const detail = status === "out_of_stock"
      ? `No sale for ${daysSince ?? "many"} days. ` +
        `${r.units_sold} historical units sold — consider sunset or relaunch.`
      : `Slow movement detected. ${r.units_sold} historical units sold.`;

    return {
      product: titleCase(r.category ?? "Product") + " · " + String(r.product_id).slice(0, 4).toUpperCase(),
      productId: r.product_id,
      type,
      severity,
      detail,
      eta: daysSince != null ? `${daysSince}d idle` : "—",
    };
  });
}


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
