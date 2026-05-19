-- =============================================================================
-- Quantuma AI — Dashboard Aggregation Views
-- =============================================================================
--  Phase: 5 of 10  (run AFTER schema.sql and policies.sql)
--
-- Every Recharts component on the React dashboard reads from a view defined
-- in this file. Views (vs ad-hoc queries from the frontend) give us:
--   - One canonical definition per chart. The component file becomes a thin
--     `select('*').from('v_revenue_monthly')`.
--   - Easy iteration: change the SQL, the UI updates without a frontend deploy.
--   - A clear contract for what each chart needs, which makes the Phase 6 +
--     Phase 7 PySpark scripts know exactly what to populate.
--
-- Views inherit the RLS of their underlying tables in Postgres 15+, so we
-- don't need separate policies here. (security_invoker = true is the default
-- on Supabase's PG15 builds; we still set it explicitly below for clarity.)
--
-- Idempotent: every view uses CREATE OR REPLACE.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- v_kpi_summary
-- Drives the 4 KPI cards at the top of DashboardPage:
--   Total Revenue, Total Orders, Active Customers, Avg Order Value
--
-- Reads the *latest* row from kpi_snapshots and joins it with the previous
-- snapshot (LAG) so each KPI also gets a period-over-period delta.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_kpi_summary
WITH (security_invoker = true) AS
WITH ranked AS (
  SELECT
    snapshot_date,
    total_revenue,
    total_orders,
    active_customers,
    avg_order_value,
    repeat_rate,
    LAG(total_revenue)    OVER (ORDER BY snapshot_date) AS prev_revenue,
    LAG(total_orders)     OVER (ORDER BY snapshot_date) AS prev_orders,
    LAG(active_customers) OVER (ORDER BY snapshot_date) AS prev_active_customers,
    LAG(avg_order_value)  OVER (ORDER BY snapshot_date) AS prev_aov,
    ROW_NUMBER()          OVER (ORDER BY snapshot_date DESC) AS rn
  FROM public.kpi_snapshots
)
SELECT
  snapshot_date,
  total_revenue,
  total_orders,
  active_customers,
  avg_order_value,
  repeat_rate,
  -- pct deltas, NULL when there is no prior snapshot
  CASE WHEN prev_revenue    IS NULL OR prev_revenue    = 0 THEN NULL
       ELSE (total_revenue    - prev_revenue)    / prev_revenue    END  AS revenue_delta,
  CASE WHEN prev_orders     IS NULL OR prev_orders     = 0 THEN NULL
       ELSE (total_orders     - prev_orders)::numeric / prev_orders END AS orders_delta,
  CASE WHEN prev_active_customers IS NULL OR prev_active_customers = 0 THEN NULL
       ELSE (active_customers - prev_active_customers)::numeric / prev_active_customers END AS active_customers_delta,
  CASE WHEN prev_aov        IS NULL OR prev_aov        = 0 THEN NULL
       ELSE (avg_order_value  - prev_aov)        / prev_aov        END AS aov_delta
FROM ranked
WHERE rn = 1;


-- -----------------------------------------------------------------------------
-- v_revenue_monthly  — 12-month area chart on DashboardPage / SalesAnalyticsPage
-- Aggregates delivered orders by month. We use payment_value (post-split) as
-- revenue because price + freight on order_items double-counts shipping.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_revenue_monthly
WITH (security_invoker = true) AS
SELECT
  date_trunc('month', o.order_purchase_timestamp)::date AS month,
  COUNT(DISTINCT o.order_id)                            AS order_count,
  COUNT(DISTINCT o.customer_id)                         AS customer_count,
  COALESCE(SUM(p.payment_value), 0)::numeric(14, 2)     AS revenue
FROM public.orders o
LEFT JOIN public.order_payments p USING (order_id)
WHERE o.order_status NOT IN ('canceled', 'unavailable')
GROUP BY 1
ORDER BY 1;


-- -----------------------------------------------------------------------------
-- v_revenue_daily_7d — last-7-days bar chart on DashboardPage
-- Limits to the most recent 7 days that have any data, so the chart isn't
-- empty when the Olist snapshot ends in 2018.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_revenue_daily_7d
WITH (security_invoker = true) AS
WITH max_day AS (
  SELECT MAX(date_trunc('day', order_purchase_timestamp)::date) AS d FROM public.orders
)
SELECT
  date_trunc('day', o.order_purchase_timestamp)::date AS day,
  COUNT(DISTINCT o.order_id)                          AS order_count,
  COALESCE(SUM(p.payment_value), 0)::numeric(14, 2)   AS revenue
FROM public.orders o
LEFT JOIN public.order_payments p USING (order_id)
CROSS JOIN max_day
WHERE o.order_purchase_timestamp >= (max_day.d - INTERVAL '6 days')
  AND o.order_purchase_timestamp <  (max_day.d + INTERVAL '1 day')
  AND o.order_status NOT IN ('canceled', 'unavailable')
GROUP BY 1
ORDER BY 1;


-- -----------------------------------------------------------------------------
-- v_segment_distribution — donut chart on DashboardPage + CustomerAnalyticsPage
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_segment_distribution
WITH (security_invoker = true) AS
SELECT
  segment_label,
  COUNT(*)                                                   AS customer_count,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) AS pct
FROM public.customer_segments
GROUP BY segment_label
ORDER BY customer_count DESC;


-- -----------------------------------------------------------------------------
-- v_customer_clusters — K-Means scatter plot on CustomerAnalyticsPage
-- One row per customer with the three features the scatter plots,
-- coloured by cluster label.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_customer_clusters
WITH (security_invoker = true) AS
SELECT
  cf.customer_unique_id,
  cf.recency_days,
  cf.frequency,
  cf.monetary,
  cf.avg_order_value,
  cs.cluster_id,
  cs.segment_label
FROM public.customer_features cf
JOIN public.customer_segments cs USING (customer_unique_id);


-- -----------------------------------------------------------------------------
-- v_top_products — top performers card grid on ProductInsightsPage
-- Top 20 by revenue. Joins the English category label for display.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_top_products
WITH (security_invoker = true) AS
SELECT
  pm.product_id,
  COALESCE(t.product_category_name_english, p.product_category_name, 'unknown') AS category,
  pm.total_revenue,
  pm.units_sold,
  pm.total_orders,
  pm.avg_review_score,
  pm.review_count,
  pm.inventory_status,
  pm.last_sold_at
FROM public.product_metrics pm
JOIN public.products p USING (product_id)
LEFT JOIN public.product_category_translation t USING (product_category_name)
ORDER BY pm.total_revenue DESC
LIMIT 20;


-- -----------------------------------------------------------------------------
-- v_category_performance — horizontal bars + heatmap on SalesAnalyticsPage
-- One row per category with revenue, order count, and avg review score.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_category_performance
WITH (security_invoker = true) AS
SELECT
  COALESCE(t.product_category_name_english, p.product_category_name, 'unknown') AS category,
  COALESCE(SUM(oi.price + oi.freight_value), 0)::numeric(14, 2) AS revenue,
  COUNT(DISTINCT oi.order_id)                                   AS order_count,
  COUNT(*)                                                      AS units_sold,
  ROUND(AVG(r.review_score), 2)                                 AS avg_review_score
FROM public.products p
LEFT JOIN public.product_category_translation t USING (product_category_name)
LEFT JOIN public.order_items oi USING (product_id)
LEFT JOIN public.order_reviews r USING (order_id)
GROUP BY 1
HAVING COUNT(oi.order_id) > 0
ORDER BY revenue DESC;


-- -----------------------------------------------------------------------------
-- v_recent_orders — recent activity table on DashboardPage
-- Last 50 orders, with the customer and an aggregated payment total.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_recent_orders
WITH (security_invoker = true) AS
SELECT
  o.order_id,
  o.order_status,
  o.order_purchase_timestamp,
  o.order_delivered_customer_date,
  c.customer_unique_id,
  c.customer_state,
  COALESCE(SUM(p.payment_value), 0)::numeric(12, 2) AS order_total
FROM public.orders o
JOIN public.customers c USING (customer_id)
LEFT JOIN public.order_payments p USING (order_id)
GROUP BY o.order_id, o.order_status, o.order_purchase_timestamp,
         o.order_delivered_customer_date, c.customer_unique_id, c.customer_state
ORDER BY o.order_purchase_timestamp DESC
LIMIT 50;


-- -----------------------------------------------------------------------------
-- v_channel_performance — channel bars on SalesAnalyticsPage
-- Olist's "channel" is essentially the payment_type, since the platform
-- doesn't tag traffic source. We treat payment_type as the channel proxy
-- and aggregate revenue + share.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_channel_performance
WITH (security_invoker = true) AS
SELECT
  payment_type AS channel,
  COUNT(DISTINCT order_id)                            AS order_count,
  COALESCE(SUM(payment_value), 0)::numeric(14, 2)     AS revenue,
  ROUND(100.0 * SUM(payment_value) / NULLIF(SUM(SUM(payment_value)) OVER (), 0), 2) AS pct_of_total
FROM public.order_payments
GROUP BY payment_type
ORDER BY revenue DESC;


-- -----------------------------------------------------------------------------
-- v_ml_model_latest — the 4 radial metric cards on MLInsightsPage
-- For each (model_name, metric_name) pair, take only the most recent training
-- run. Lets the dashboard show "current model health" without aggregating.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ml_model_latest
WITH (security_invoker = true) AS
SELECT DISTINCT ON (model_name, metric_name)
  model_name,
  metric_name,
  metric_value,
  params,
  trained_at
FROM public.ml_model_runs
ORDER BY model_name, metric_name, trained_at DESC;


-- -----------------------------------------------------------------------------
-- v_top_recommendations — recommendation grid on RecommendationPage
-- Latest generation per customer, with product + category enriched.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_top_recommendations
WITH (security_invoker = true) AS
WITH latest_per_customer AS (
  SELECT customer_unique_id, MAX(generated_at) AS generated_at
  FROM public.recommendations
  GROUP BY customer_unique_id
)
SELECT
  r.customer_unique_id,
  r.product_id,
  r.rank,
  r.score,
  COALESCE(t.product_category_name_english, p.product_category_name, 'unknown') AS category,
  pm.avg_review_score,
  pm.total_revenue
FROM public.recommendations r
JOIN latest_per_customer USING (customer_unique_id, generated_at)
JOIN public.products p USING (product_id)
LEFT JOIN public.product_category_translation t USING (product_category_name)
LEFT JOIN public.product_metrics pm USING (product_id)
ORDER BY r.customer_unique_id, r.rank;


-- =============================================================================
-- Done. Optional: run seed.sql to populate tiny sample data for the UI.
-- =============================================================================
