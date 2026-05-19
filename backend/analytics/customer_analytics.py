"""
customer_analytics — customer-side KPI columns for public.kpi_snapshots.

What we produce per snapshot_date
─────────────────────────────────
  total_customers   running unique customers up to and including this date
  active_customers  unique customers who bought in the *trailing 30 days*
                    (window ends on snapshot_date inclusive)
  repeat_rate       share of customers (by purchase count) whose total
                    order count through this date is >= 2.  0..1 range.

Implementation notes
────────────────────
- "Trailing 30 days" uses BETWEEN (snapshot_date - 29 days) AND snapshot_date
  so the window is exactly 30 days long, snapshot_date inclusive.
- running totals are cheap on Olist's ~700 days × ~100k customers — we
  pivot via a join rather than a window because the cardinality keeps it
  trivial and the SQL plan stays explicit.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F


def compute(master: DataFrame) -> DataFrame:
    """
    Returns a Spark DataFrame keyed on snapshot_date with customer columns.

    Columns: snapshot_date, total_customers, active_customers, repeat_rate
    """
    base = (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("purchase_date").isNotNull())
        .filter(F.col("customer_unique_id").isNotNull())
        .select(
            F.col("purchase_date").alias("d"),
            "customer_unique_id",
            "order_id",
        )
        .dropDuplicates(["d", "customer_unique_id", "order_id"])
    )

    # All distinct snapshot dates in the data.
    dates = base.select(F.col("d").alias("snapshot_date")).distinct()

    # 1) total_customers  = unique customers whose first purchase <= snapshot_date
    first_purchase = (
        base.groupBy("customer_unique_id")
            .agg(F.min("d").alias("first_d"))
    )
    total_customers = (
        dates.alias("dt")
             .join(first_purchase.alias("fp"),
                   F.col("fp.first_d") <= F.col("dt.snapshot_date"))
             .groupBy("dt.snapshot_date")
             .agg(F.countDistinct("fp.customer_unique_id").alias("total_customers"))
    )

    # 2) active_customers  = unique customers with any purchase in the trailing 30 days
    active = (
        dates.alias("dt")
             .join(base.alias("b"),
                   (F.col("b.d") >= F.date_sub(F.col("dt.snapshot_date"), 29)) &
                   (F.col("b.d") <= F.col("dt.snapshot_date")))
             .groupBy("dt.snapshot_date")
             .agg(F.countDistinct("b.customer_unique_id").alias("active_customers"))
    )

    # 3) repeat_rate = (customers with >= 2 orders through snapshot_date) /
    #                  (total_customers through snapshot_date)
    cum_orders = (
        dates.alias("dt")
             .join(base.alias("b"), F.col("b.d") <= F.col("dt.snapshot_date"))
             .groupBy("dt.snapshot_date", "b.customer_unique_id")
             .agg(F.countDistinct("b.order_id").alias("orders_to_date"))
    )

    repeat = (
        cum_orders.groupBy("snapshot_date")
                  .agg(
                      F.countDistinct(F.when(F.col("orders_to_date") >= 2,
                                             F.col("customer_unique_id"))).alias("repeat_customers"),
                      F.countDistinct("customer_unique_id").alias("denom_customers"),
                  )
                  .withColumn(
                      "repeat_rate",
                      F.when(F.col("denom_customers") > 0,
                             F.col("repeat_customers") / F.col("denom_customers"))
                       .otherwise(F.lit(0.0))
                       .cast("decimal(5,4)"),
                  )
                  .select("snapshot_date", "repeat_rate")
    )

    out = (
        total_customers
        .join(active, on="snapshot_date", how="left")
        .join(repeat, on="snapshot_date", how="left")
        .fillna({"active_customers": 0})
        .withColumn(
            "repeat_rate",
            F.coalesce(F.col("repeat_rate"), F.lit(0.0).cast("decimal(5,4)")),
        )
    )
    return out
