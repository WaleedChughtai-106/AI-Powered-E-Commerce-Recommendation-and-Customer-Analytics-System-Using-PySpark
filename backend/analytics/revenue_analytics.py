"""
revenue_analytics — daily KPI roll-ups that feed public.kpi_snapshots.

What we produce
───────────────
One row per snapshot_date with the four headline KPIs:

  total_revenue    sum of item_revenue over non-canceled orders, that day
  total_orders     distinct orders that day
  avg_order_value  total_revenue / total_orders, NULL-safe

Customer-side KPIs (total_customers, active_customers, repeat_rate) live in
`customer_analytics.py` and get joined with this output in the orchestrator
before the final write.

Snapshot strategy
─────────────────
We compute one row per *day in the dataset*. The dashboard's KPI view
(`v_kpi_summary`) picks the latest row and joins LAG() for the period-over-period
delta — so as long as there are at least two snapshots, the deltas render.
Using daily snapshots also lets the React UI plot a small KPI history if
Phase 10 ever decides to.
"""

from __future__ import annotations

import pandas as pd
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F


def compute(master: DataFrame) -> DataFrame:
    """
    Returns a Spark DataFrame keyed on snapshot_date with revenue columns.

    Columns: snapshot_date, total_revenue, total_orders, avg_order_value
    """
    daily = (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("purchase_date").isNotNull())
        .groupBy(F.col("purchase_date").alias("snapshot_date"))
        .agg(
            F.sum("item_revenue").alias("total_revenue"),
            F.countDistinct("order_id").alias("total_orders"),
        )
        .withColumn(
            "avg_order_value",
            F.when(F.col("total_orders") > 0,
                   F.col("total_revenue") / F.col("total_orders"))
             .otherwise(F.lit(0.0)),
        )
        .withColumn("total_revenue",   F.col("total_revenue").cast("decimal(14,2)"))
        .withColumn("avg_order_value", F.col("avg_order_value").cast("decimal(12,2)"))
    )
    return daily
