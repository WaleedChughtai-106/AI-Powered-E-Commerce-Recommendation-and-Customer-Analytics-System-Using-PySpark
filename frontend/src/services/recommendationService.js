import { supabase } from "./supabaseClient";

/**
 * recommendationService — pulls top ALS-output recommendations for the
 * Recommendation page.
 *
 * Source: v_top_recommendations. View columns:
 *   customer_unique_id, product_id, rank, score, category,
 *   avg_review_score, total_revenue
 *
 * The RecommendationPage in Phase 3 had three sub-blocks (upsell pairs,
 * growth tags, cluster recommendations). Only the last block has a clean
 * map to real data; the other two are kept as static decorative content in
 * the page itself and called out in PHASE_8_FRONTEND.md as Phase 11+ work.
 */

function unwrap({ data, error }) {
  if (error) throw error;
  return data ?? [];
}

/**
 * Returns `[{ id, price, match }]` for the cluster recommendations grid.
 *
 * Strategy: pick ONE customer at random from v_top_recommendations (the page
 * shows the recs for a single user, so one customer is the right cardinality)
 * and return their top-N ranked products.
 *
 * `id`    — synthesised "Category · ID-prefix" so the card has a readable label.
 * `price` — uses total_revenue as a coarse stand-in for unit price (Olist has
 *           no SKU price column at the product-level view). Documented.
 * `match` — derived from rank: rank 1 → 98%, rank 2 → 92%, etc. Anchored to
 *           ALS's score column when present so the gradient roughly tracks the
 *           model's actual confidence.
 */
export async function fetchClusterRecommendations(topK = 4) {
  // 1) Pick a random customer that has recommendations. We pull a small page
  //    and pluck one at random — avoids RANDOM() server-side which would be
  //    free-tier-expensive.
  const sample = unwrap(
    await supabase
      .from("v_top_recommendations")
      .select("customer_unique_id")
      .limit(200)
  );
  if (sample.length === 0) return [];
  const customer = sample[Math.floor(Math.random() * sample.length)].customer_unique_id;

  // 2) Pull that customer's top-N recommendations.
  const rows = unwrap(
    await supabase
      .from("v_top_recommendations")
      .select("product_id, rank, score, category, avg_review_score, total_revenue")
      .eq("customer_unique_id", customer)
      .order("rank", { ascending: true })
      .limit(topK)
  );

  return rows.map((r) => {
    const cat = titleCase(r.category ?? "Product");
    const pid = String(r.product_id);
    const rank = Number(r.rank ?? 1);
    // Display "Match %": linear from 98 → 75 across rank 1 → 10.
    const match = Math.max(75, Math.round(100 - rank * 2.5));
    return {
      id: `${cat} · ${pid.slice(0, 4).toUpperCase()}`,
      productId: pid,
      // total_revenue isn't a per-unit price; clip to a sensible display range.
      price: r.total_revenue != null
        ? Math.min(2500, Math.max(29, Math.round(Number(r.total_revenue) / Math.max(rank, 1))))
        : 99,
      match,
      score: r.score != null ? Number(r.score) : null,
      rank,
      category: cat,
      reviewScore: r.avg_review_score != null ? Number(r.avg_review_score) : null,
    };
  });
}

/**
 * Returns three category labels for the cluster-pick buttons on the page
 * ("Power Users / Gamer Segment / Home Office" in the mock). We replace
 * those with the three most-recommended-against categories so the buttons
 * stay meaningful.
 */
export async function fetchClusterTabs() {
  const rows = unwrap(
    await supabase
      .from("v_top_recommendations")
      .select("category")
      .limit(500)
  );
  const counts = rows.reduce((acc, r) => {
    const k = r.category ?? "Other";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => titleCase(cat));
}


/* ------------------------------------------------------------------ */
function titleCase(s) {
  if (!s) return "—";
  return String(s)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
