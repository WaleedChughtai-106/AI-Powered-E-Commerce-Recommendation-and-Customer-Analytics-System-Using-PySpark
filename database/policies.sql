-- =============================================================================
-- Quantuma AI — Row Level Security (RLS) Policies
-- =============================================================================
--  Phase: 5 of 10  (run AFTER schema.sql)
--
-- Security model
-- ──────────────
-- The dashboard is a single-tenant analytics tool: every signed-in user is
-- staff who should be able to read every row. There is no per-user data
-- partition. Writes happen exclusively from the PySpark pipeline, which
-- connects with the service_role key — that key bypasses RLS entirely
-- (Supabase enforces this in the postgres role system), so the policies
-- below intentionally only define SELECT.
--
-- Three Postgres roles relevant to Supabase:
--   anon           — anonymous (not signed in). Default: no access.
--   authenticated  — anyone with a valid JWT from supabase.auth. SELECT only.
--   service_role   — used by the backend (PySpark). Bypasses RLS.
--
-- If you later need per-organisation tenancy, the cleanest refactor is:
--   1. Add an org_id column to each table.
--   2. Add the user → org mapping to auth.users.raw_user_meta_data.
--   3. Replace the `USING (true)` policies below with
--      `USING (org_id = (auth.jwt() ->> 'org_id'))`.
-- We are NOT doing that for the semester project.
--
-- Idempotency: it is safe to re-run this file. Every policy is dropped
-- before re-creation so changes propagate cleanly.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: enable RLS on every table we own.
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_category_translation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_features            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_metrics              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_snapshots                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_forecasts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_model_runs                ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Read policies — one per table, all the same shape: "authenticated users
-- can SELECT every row". We define them explicitly (vs a loop or a single
-- policy on a parent) so the Supabase dashboard's "Authentication → Policies"
-- view shows a clear row per table.
-- -----------------------------------------------------------------------------

-- A small DO block lets us drop-then-create without copy-pasting 15× lines.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customers', 'sellers', 'product_category_translation', 'products',
    'orders', 'order_items', 'order_payments', 'order_reviews',
    'customer_features', 'customer_segments', 'recommendations',
    'product_metrics', 'kpi_snapshots', 'sales_forecasts', 'ml_model_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop the existing policy if present (idempotent re-runs).
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'authenticated_read_' || t, t
    );

    -- Create the SELECT policy for the `authenticated` role.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      'authenticated_read_' || t, t
    );
  END LOOP;
END
$$ LANGUAGE plpgsql;


-- -----------------------------------------------------------------------------
-- Grant table-level privileges to the authenticated role.
-- Note: enabling RLS without granting SELECT to the role would still deny
-- access — the role needs *both* the privilege AND a passing policy.
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- And ensure future tables (created later in the project) inherit the grant.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO authenticated;


-- -----------------------------------------------------------------------------
-- Explicitly REVOKE write access from `authenticated`. The dashboard never
-- mutates analytics data — that is the PySpark pipeline's job (service_role).
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;


-- -----------------------------------------------------------------------------
-- anon (not signed in) gets no access. This is the Supabase default but we
-- state it explicitly for safety / for the viva.
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;


-- =============================================================================
-- Done. Next: views.sql for dashboard aggregations.
-- =============================================================================
