"""
analytics — pure Spark aggregations that populate Supabase's analytics tables.

Each submodule defines a `compute(...)` and a `run(spark, push_to_db)` pair.
The split keeps the responsibilities legible:

    revenue_analytics   → public.kpi_snapshots
    customer_analytics  → contributions to public.kpi_snapshots (active_customers, repeat_rate)
    product_analytics   → public.product_metrics
    category_analytics  → diagnostic per-category aggregate (Parquet only)

The orchestrator (`scripts/run_ml_pipeline.py`) composes these in the right
order so kpi_snapshots ends up with revenue + customer columns merged into
a single per-day row.
"""
