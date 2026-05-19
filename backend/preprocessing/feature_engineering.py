"""
feature_engineering — RFM features per customer_unique_id.

What RFM is and why it matters
──────────────────────────────
RFM is a 50-year-old marketing-analytics framework that scores each customer
on three dimensions:

  • Recency  — days since their last purchase. Lower is hotter.
  • Frequency — number of distinct orders ever. Higher is more engaged.
  • Monetary — total spend across all orders. Higher is more valuable.

For an unsupervised segmentation problem (we don't have labels saying
"this person is a VIP"), RFM gives K-Means a small, well-behaved feature
space that produces interpretable clusters: a centroid with very low
recency and high monetary is naturally the "VIP" cluster, etc.

Cancelled orders are excluded from frequency and monetary so a customer
with 4 cancellations doesn't look like a power user.

Output schema (one row per customer_unique_id) lines up with
public.customer_features in database/schema.sql:

  customer_unique_id : str (PK)
  recency_days       : int
  frequency          : int
  monetary           : numeric(14, 2)
  avg_order_value    : numeric(12, 2)
  first_purchase_at  : timestamp
  last_purchase_at   : timestamp
  total_orders       : int
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DecimalType, IntegerType


def compute_rfm(spark: SparkSession, master: DataFrame) -> DataFrame:
    """
    Parameters
    ----------
    master : DataFrame
        Output of preprocessing.join_datasets.join_master.

    Returns
    -------
    DataFrame
        One row per customer_unique_id with the columns described above.
    """

    # Use order-level grain so the same order isn't counted N times for an
    # order with N line items. We still pull payment totals from the master
    # (already order-level aggregated upstream).
    orders_grain = (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("customer_unique_id").isNotNull())
        .filter(F.col("order_purchase_timestamp").isNotNull())
        .groupBy("customer_unique_id", "order_id", "order_purchase_timestamp")
        .agg(
            F.first("order_total_paid", ignorenulls=True).alias("order_value"),
        )
    )

    # Reference date = the maximum order_purchase_timestamp in the dataset.
    # Using "now()" would make recency comparable across runs but it would
    # also place every Olist customer at 2400+ days recency because the
    # dataset ends in 2018. Anchoring to max(purchase_ts) makes the four
    # RFM-driven clusters meaningful in their own time-frame.
    ref_date_row = orders_grain.agg(F.max("order_purchase_timestamp").alias("ref")).first()
    ref_date = ref_date_row["ref"] if ref_date_row else None

    if ref_date is None:
        raise RuntimeError(
            "No orders with a purchase timestamp survived cleaning — cannot "
            "compute RFM. Check the cleaning steps and the source data."
        )

    rfm = (
        orders_grain
        .groupBy("customer_unique_id")
        .agg(
            F.max("order_purchase_timestamp").alias("last_purchase_at"),
            F.min("order_purchase_timestamp").alias("first_purchase_at"),
            F.countDistinct("order_id").alias("frequency"),
            F.sum(F.coalesce(F.col("order_value"), F.lit(0))).alias("monetary"),
        )
        .withColumn(
            "recency_days",
            F.datediff(F.lit(ref_date), F.col("last_purchase_at")).cast(IntegerType()),
        )
        .withColumn(
            "avg_order_value",
            (F.col("monetary") / F.greatest(F.col("frequency"), F.lit(1)))
            .cast(DecimalType(12, 2)),
        )
        .withColumn("monetary", F.col("monetary").cast(DecimalType(14, 2)))
        .withColumn("total_orders", F.col("frequency"))
    )

    # Final column order matches public.customer_features.
    return rfm.select(
        "customer_unique_id",
        "recency_days",
        "frequency",
        "monetary",
        "avg_order_value",
        "first_purchase_at",
        "last_purchase_at",
        "total_orders",
    )
