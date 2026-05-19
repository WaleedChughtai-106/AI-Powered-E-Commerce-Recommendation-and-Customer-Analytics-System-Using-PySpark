"""
category_analytics — per-category aggregate.

There's no dedicated Postgres table for this — the dashboard's
`v_category_performance` view computes the same aggregate on the fly from
products + order_items + order_reviews. We still materialise it here for
two reasons:

  1. It's a useful cross-check during the viva: `category_metrics.parquet`
     should match what `v_category_performance` returns row-for-row.
  2. The optional `--push-to-db` step does NOT push this; it's purely a
     local artefact that's cheap to re-compute and exists for debugging.

If a future phase decides to denormalise into Supabase for performance,
the obvious target is a `category_metrics` table with the same shape.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from spark_utils import read_parquet, write_parquet


def compute(master: DataFrame) -> DataFrame:
    """
    Returns a Spark DataFrame keyed on `category` (English label) with:
        revenue, order_count, units_sold, avg_review_score
    Filters out rows without a known product (defensive — should be empty
    on the augmented dataset).
    """
    return (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("category").isNotNull())
        .groupBy("category")
        .agg(
            F.sum("item_revenue").alias("revenue"),
            F.countDistinct("order_id").alias("order_count"),
            F.count("*").alias("units_sold"),
            F.avg("review_score_avg").alias("avg_review_score"),
        )
        .withColumn("revenue",          F.col("revenue").cast("decimal(14,2)"))
        .withColumn("avg_review_score", F.col("avg_review_score").cast("decimal(3,2)"))
        .orderBy(F.desc("revenue"))
    )


def run(spark: SparkSession, push_to_db: bool = False) -> dict:
    """Materialise category_metrics to Parquet. Push-to-db is a no-op (no table)."""
    master = read_parquet(spark, "master_facts")
    df = compute(master)
    write_parquet(df, "category_metrics")
    n = df.count()
    print(f"    category_metrics: {n:,} rows")
    if push_to_db:
        print("    (category_metrics has no Supabase target — Parquet only)")
    return {"n_rows": int(n)}
