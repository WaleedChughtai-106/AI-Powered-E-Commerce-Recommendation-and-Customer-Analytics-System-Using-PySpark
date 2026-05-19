-- =============================================================================
-- Quantuma AI — Database Schema
-- =============================================================================
--   Project: AI-Powered E-Commerce Recommendation and Customer Analytics System
--   Phase:   5 of 10
--   Target:  Supabase / PostgreSQL 15+
--
-- Two groups of tables live here:
--
--   1) RAW LAYER — mirrors the public Olist Brazilian E-Commerce dataset.
--      These get populated by the PySpark ingestion job in Phase 6 from
--      backend/data/raw/*.csv. Column names match the source files so we
--      can do a straight `df.write.jdbc(...)` without renaming.
--
--   2) ANALYTICS LAYER — populated by the Spark MLlib + analytics scripts
--      in Phase 6 and 7. The React dashboard reads from these tables (and
--      from the views in views.sql) using the Supabase JS client.
--
-- Run order:
--   1. schema.sql   (this file)
--   2. policies.sql (Row Level Security)
--   3. views.sql    (dashboard aggregations)
--   4. seed.sql     (optional: small sample so the UI has data immediately)
--
-- How to run: Supabase dashboard → SQL Editor → New query → paste → Run.
-- It is safe to re-run: every CREATE uses IF NOT EXISTS and every drop is
-- guarded. Existing data is preserved.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- pgcrypto: gives us gen_random_uuid() for surrogate keys on computed tables.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 1) RAW LAYER — Olist dataset
-- =============================================================================
-- Source: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
-- ~100k orders across 2016-2018. We keep the original column names so the
-- PySpark JDBC writer in Phase 6 can dump straight to Postgres.


-- customers ------------------------------------------------------------------
-- Note: Olist gives each *order* a fresh customer_id (uuid-style string) AND
-- a stable customer_unique_id that identifies the human across orders.
-- The K-Means RFM analysis groups by customer_unique_id, not customer_id.
CREATE TABLE IF NOT EXISTS public.customers (
  customer_id              text PRIMARY KEY,
  customer_unique_id       text NOT NULL,
  customer_zip_code_prefix text,
  customer_city            text,
  customer_state           char(2)
);
CREATE INDEX IF NOT EXISTS idx_customers_unique_id ON public.customers (customer_unique_id);
CREATE INDEX IF NOT EXISTS idx_customers_state     ON public.customers (customer_state);

COMMENT ON TABLE  public.customers              IS 'Olist customer roster. customer_id is per-order, customer_unique_id is per-person.';
COMMENT ON COLUMN public.customers.customer_id  IS 'Order-scoped customer key (FK target for orders.customer_id).';
COMMENT ON COLUMN public.customers.customer_unique_id IS 'Stable per-person key. Use this for RFM and segmentation.';


-- sellers --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sellers (
  seller_id              text PRIMARY KEY,
  seller_zip_code_prefix text,
  seller_city            text,
  seller_state           char(2)
);
CREATE INDEX IF NOT EXISTS idx_sellers_state ON public.sellers (seller_state);


-- product_category_translation ----------------------------------------------
-- Olist categories are in Portuguese. This table maps to English so the
-- dashboard renders friendly labels.
CREATE TABLE IF NOT EXISTS public.product_category_translation (
  product_category_name         text PRIMARY KEY,
  product_category_name_english text NOT NULL
);


-- products -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  product_id                 text PRIMARY KEY,
  product_category_name      text REFERENCES public.product_category_translation (product_category_name) ON DELETE SET NULL,
  product_name_lenght        integer,    -- (sic — Olist's typo, preserved on purpose)
  product_description_lenght integer,    -- (sic)
  product_photos_qty         integer,
  product_weight_g           integer,
  product_length_cm          integer,
  product_height_cm          integer,
  product_width_cm           integer
);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (product_category_name);

COMMENT ON COLUMN public.products.product_name_lenght IS
  'Misspelled in the source dataset. Kept as-is so PySpark ingestion is a one-liner.';


-- orders ---------------------------------------------------------------------
-- order_status values present in the source: delivered, shipped, canceled,
-- unavailable, invoiced, processing, created, approved. Constraint is loose
-- on purpose — we treat any non-delivered as in-flight for KPI views.
CREATE TABLE IF NOT EXISTS public.orders (
  order_id                      text PRIMARY KEY,
  customer_id                   text NOT NULL REFERENCES public.customers (customer_id) ON DELETE CASCADE,
  order_status                  text NOT NULL,
  order_purchase_timestamp      timestamptz NOT NULL,
  order_approved_at             timestamptz,
  order_delivered_carrier_date  timestamptz,
  order_delivered_customer_date timestamptz,
  order_estimated_delivery_date timestamptz
);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_purchase_ts ON public.orders (order_purchase_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders (order_status);


-- order_items ----------------------------------------------------------------
-- An order can contain multiple line items; the (order_id, order_item_id) pair
-- is the primary key. order_item_id is a sequence within the order, NOT a
-- global identifier — Olist counts 1..N for each order.
CREATE TABLE IF NOT EXISTS public.order_items (
  order_id            text NOT NULL REFERENCES public.orders   (order_id)   ON DELETE CASCADE,
  order_item_id       integer NOT NULL,
  product_id          text NOT NULL REFERENCES public.products (product_id) ON DELETE RESTRICT,
  seller_id           text NOT NULL REFERENCES public.sellers  (seller_id)  ON DELETE RESTRICT,
  shipping_limit_date timestamptz,
  price               numeric(12, 2) NOT NULL CHECK (price >= 0),
  freight_value       numeric(12, 2) NOT NULL CHECK (freight_value >= 0),
  PRIMARY KEY (order_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id  ON public.order_items (seller_id);


-- order_payments -------------------------------------------------------------
-- An order can have multiple payment splits (e.g. partial gift-card + credit).
CREATE TABLE IF NOT EXISTS public.order_payments (
  order_id             text NOT NULL REFERENCES public.orders (order_id) ON DELETE CASCADE,
  payment_sequential   integer NOT NULL,
  payment_type         text    NOT NULL,
  payment_installments integer NOT NULL CHECK (payment_installments >= 0),
  payment_value        numeric(12, 2) NOT NULL CHECK (payment_value >= 0),
  PRIMARY KEY (order_id, payment_sequential)
);
CREATE INDEX IF NOT EXISTS idx_order_payments_type ON public.order_payments (payment_type);


-- order_reviews --------------------------------------------------------------
-- Olist has duplicate review_ids across orders (it's an annoying quirk of the
-- source). We use (review_id, order_id) as the composite key, which matches
-- the de-duplication strategy in the PySpark cleaning script.
CREATE TABLE IF NOT EXISTS public.order_reviews (
  review_id               text NOT NULL,
  order_id                text NOT NULL REFERENCES public.orders (order_id) ON DELETE CASCADE,
  review_score            smallint NOT NULL CHECK (review_score BETWEEN 1 AND 5),
  review_comment_title    text,
  review_comment_message  text,
  review_creation_date    timestamptz,
  review_answer_timestamp timestamptz,
  PRIMARY KEY (review_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_order_reviews_order_id ON public.order_reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_score    ON public.order_reviews (review_score);


-- =============================================================================
-- 2) ANALYTICS LAYER — populated by PySpark in Phase 6 & 7
-- =============================================================================


-- customer_features ----------------------------------------------------------
-- One row per customer_unique_id. Output of feature_engineering.py.
-- The K-Means segmenter consumes recency / frequency / monetary as the input
-- vector. avg_order_value and last_purchase_at are kept for display only.
CREATE TABLE IF NOT EXISTS public.customer_features (
  customer_unique_id text PRIMARY KEY,
  recency_days       integer        NOT NULL,
  frequency          integer        NOT NULL CHECK (frequency >= 0),
  monetary           numeric(14, 2) NOT NULL CHECK (monetary >= 0),
  avg_order_value    numeric(12, 2) NOT NULL DEFAULT 0,
  first_purchase_at  timestamptz,
  last_purchase_at   timestamptz,
  total_orders       integer        NOT NULL DEFAULT 0,
  computed_at        timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_features_recency  ON public.customer_features (recency_days);
CREATE INDEX IF NOT EXISTS idx_customer_features_monetary ON public.customer_features (monetary DESC);


-- customer_segments ----------------------------------------------------------
-- Output of K-Means (kmeans_segmentation.py). cluster_id is the raw label
-- from MLlib; segment_label is the human-friendly translation that the
-- segmenter script assigns by inspecting each cluster's centroid:
--   VIP    → highest monetary + lowest recency
--   Loyal  → high frequency + medium monetary
--   At-Risk→ high recency (haven't bought in a while)
--   New    → low frequency + recent first purchase
CREATE TABLE IF NOT EXISTS public.customer_segments (
  customer_unique_id text PRIMARY KEY REFERENCES public.customer_features (customer_unique_id) ON DELETE CASCADE,
  cluster_id         smallint NOT NULL CHECK (cluster_id BETWEEN 0 AND 9),
  segment_label      text     NOT NULL CHECK (segment_label IN ('VIP', 'Loyal', 'At Risk', 'New')),
  distance_to_centroid double precision,  -- diagnostic: how tightly this customer fits the cluster
  assigned_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_segments_label ON public.customer_segments (segment_label);


-- recommendations ------------------------------------------------------------
-- Output of ALS collaborative filtering (als_recommender.py).
-- Each customer gets a small top-K list (typically K=10). rank is 1-based.
CREATE TABLE IF NOT EXISTS public.recommendations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_unique_id text NOT NULL,
  product_id         text NOT NULL REFERENCES public.products (product_id) ON DELETE CASCADE,
  rank               smallint NOT NULL CHECK (rank BETWEEN 1 AND 50),
  score              real     NOT NULL,
  generated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_unique_id, rank, generated_at)
);
CREATE INDEX IF NOT EXISTS idx_recommendations_customer ON public.recommendations (customer_unique_id, rank);
CREATE INDEX IF NOT EXISTS idx_recommendations_product  ON public.recommendations (product_id);


-- product_metrics ------------------------------------------------------------
-- One row per product. Refreshed by run_analytics.py.
CREATE TABLE IF NOT EXISTS public.product_metrics (
  product_id        text PRIMARY KEY REFERENCES public.products (product_id) ON DELETE CASCADE,
  total_revenue     numeric(14, 2) NOT NULL DEFAULT 0,
  units_sold        integer        NOT NULL DEFAULT 0,
  total_orders      integer        NOT NULL DEFAULT 0,
  avg_review_score  numeric(3, 2),
  review_count      integer        NOT NULL DEFAULT 0,
  last_sold_at      timestamptz,
  inventory_status  text CHECK (inventory_status IN ('healthy', 'low', 'out_of_stock')) DEFAULT 'healthy',
  computed_at       timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_metrics_revenue ON public.product_metrics (total_revenue DESC);


-- kpi_snapshots --------------------------------------------------------------
-- One row per snapshot_date. The dashboard's KPI cards read the latest row;
-- the period-over-period delta is computed against the previous snapshot.
CREATE TABLE IF NOT EXISTS public.kpi_snapshots (
  snapshot_date     date PRIMARY KEY,
  total_revenue     numeric(14, 2) NOT NULL DEFAULT 0,
  total_orders      integer        NOT NULL DEFAULT 0,
  total_customers   integer        NOT NULL DEFAULT 0,
  active_customers  integer        NOT NULL DEFAULT 0,    -- bought in the last 30 days
  avg_order_value   numeric(12, 2) NOT NULL DEFAULT 0,
  repeat_rate       numeric(5, 4)  NOT NULL DEFAULT 0,    -- 0..1, share of customers with >1 order
  computed_at       timestamptz    NOT NULL DEFAULT now()
);


-- sales_forecasts ------------------------------------------------------------
-- Output of the optional scikit-learn forecaster (sales_forecast.py).
-- We store predicted revenue per future day with a confidence interval.
CREATE TABLE IF NOT EXISTS public.sales_forecasts (
  forecast_date      date PRIMARY KEY,
  predicted_revenue  numeric(14, 2) NOT NULL,
  lower_bound        numeric(14, 2),
  upper_bound        numeric(14, 2),
  model_name         text NOT NULL DEFAULT 'sklearn-linreg',
  generated_at       timestamptz NOT NULL DEFAULT now()
);


-- ml_model_runs --------------------------------------------------------------
-- Auditing / "AI Insights" page. Each Spark or sklearn training run inserts
-- one row with the metric the dashboard cards display (silhouette, RMSE,
-- precision@10, etc.). params is jsonb so we can store hyper-parameters
-- without schema churn.
CREATE TABLE IF NOT EXISTS public.ml_model_runs (
  run_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name    text NOT NULL,           -- 'kmeans' | 'als' | 'sales_forecast' | ...
  metric_name   text NOT NULL,           -- 'silhouette' | 'rmse' | 'precision_at_k' | ...
  metric_value  double precision NOT NULL,
  params        jsonb NOT NULL DEFAULT '{}'::jsonb,
  trained_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ml_model_runs_model_metric ON public.ml_model_runs (model_name, metric_name, trained_at DESC);


-- =============================================================================
-- Done. Next: policies.sql to enable RLS.
-- =============================================================================
