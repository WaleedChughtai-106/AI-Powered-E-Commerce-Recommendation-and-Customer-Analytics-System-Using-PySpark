"""
product_analytics — per-product aggregates that populate public.product_metrics.

What we produce (one row per product_id)
────────────────────────────────────────
  total_revenue     sum of item_revenue (price + freight) over non-canceled orders
  units_sold        count of order_items rows (an order_item line == one unit
                    in Olist's encoding — quantity is not a separate column)
  total_orders      count of distinct orders that included this product
  avg_review_score  mean of review_score across orders containing this product
  review_count      number of reviews tied to those orders
  last_sold_at      most recent purchase timestamp of any non-canceled order
  inventory_status  derived: 'out_of_stock' if last sale > 180 days ago,
                    'low' if 90..180, 'healthy' otherwise.

`inventory_status` is a heuristic because Olist doesn't expose stock-level
data. The thresholds are picked to put roughly the bottom 5% of products
into `out_of_stock` so the dashboard's badge has *some* signal to colour;
the rule is documented here so the viva audience can challenge it.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from spark_utils import read_parquet, write_parquet, write_dataframe_to_postgres


# Days since last sale → inventory_status bucket
LOW_THRESHOLD          = 90
OUT_OF_STOCK_THRESHOLD = 180


def compute(master: DataFrame) -> DataFrame:
    """Returns a Spark DataFrame matching public.product_metrics' columns."""
    # The dataset's reference date is the most recent purchase. Same anchoring
    # logic as RFM — `now()` would mark every Olist product as out-of-stock.
    ref_date_row = (
        master.filter(~F.col("is_canceled"))
              .agg(F.max("order_purchase_timestamp").alias("ref"))
              .first()
    )
    ref_date = ref_date_row["ref"] if ref_date_row else None
    if ref_date is None:
        raise RuntimeError("No non-canceled orders in master_facts.")

    agg = (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("product_id").isNotNull())
        .groupBy("product_id")
        .agg(
            F.sum("item_revenue").alias("total_revenue"),
            F.count("*").alias("units_sold"),
            F.countDistinct("order_id").alias("total_orders"),
            F.avg("review_score_avg").alias("avg_review_score"),
            F.sum(F.coalesce(F.col("review_count"), F.lit(0))).alias("review_count"),
            F.max("order_purchase_timestamp").alias("last_sold_at"),
        )
    )

    out = (
        agg
        .withColumn("days_since_sale",
                    F.datediff(F.lit(ref_date), F.col("last_sold_at")))
        .withColumn(
            "inventory_status",
            F.when(F.col("days_since_sale") > OUT_OF_STOCK_THRESHOLD, F.lit("out_of_stock"))
             .when(F.col("days_since_sale") > LOW_THRESHOLD,          F.lit("low"))
             .otherwise(F.lit("healthy")),
        )
        .withColumn("total_revenue",    F.col("total_revenue").cast("decimal(14,2)"))
        .withColumn("avg_review_score", F.col("avg_review_score").cast("decimal(3,2)"))
        .withColumn("review_count",     F.col("review_count").cast("int"))
        .withColumn("computed_at",      F.lit(datetime.now(timezone.utc)))
        .select(
            "product_id",
            "total_revenue",
            "units_sold",
            "total_orders",
            "avg_review_score",
            "review_count",
            "last_sold_at",
            "inventory_status",
            "computed_at",
        )
    )
    return out


def run(spark: SparkSession, push_to_db: bool = False) -> dict:
    """Compute, persist to Parquet + (optionally) Supabase."""
    master = read_parquet(spark, "master_facts")
    metrics = compute(master)
    write_parquet(metrics, "product_metrics")
    n = metrics.count()
    print(f"    product_metrics: {n:,} rows")

    if push_to_db:
        # FK is on products(product_id). The augmented categories pass in
        # Phase 6 already ensures every product_id we have in master is also
        # in public.products, so no rows should be rejected.
        write_dataframe_to_postgres(
            metrics,
            table="public.product_metrics",
            primary_keys=["product_id"],
        )
    return {"n_rows": int(n)}
