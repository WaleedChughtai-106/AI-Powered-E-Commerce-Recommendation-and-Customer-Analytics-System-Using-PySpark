"""
clean_orders — Olist orders dataset.

Cleaning
────────
- Drop rows missing order_id or customer_id (both are NOT NULL in schema).
- Cast all five date columns to timestamp. The source format is
  "YYYY-MM-DD HH:mm:ss"; Spark parses that natively but we set timeZone=UTC
  in the SparkSession so they're interpreted consistently.
- Lower-case + trim order_status to make later filters predictable.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("order_id",                      StringType(), nullable=False),
    StructField("customer_id",                   StringType(), nullable=False),
    StructField("order_status",                  StringType(), nullable=True),
    StructField("order_purchase_timestamp",      StringType(), nullable=True),
    StructField("order_approved_at",             StringType(), nullable=True),
    StructField("order_delivered_carrier_date",  StringType(), nullable=True),
    StructField("order_delivered_customer_date", StringType(), nullable=True),
    StructField("order_estimated_delivery_date", StringType(), nullable=True),
])

_TS_COLS = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "olist_orders_dataset.csv", schema=SCHEMA)

    df = df.dropna(subset=["order_id", "customer_id"])

    # Cast date columns -> timestamp.
    for col in _TS_COLS:
        df = df.withColumn(col, F.to_timestamp(F.col(col), "yyyy-MM-dd HH:mm:ss"))

    df = (
        df.withColumn("order_status",
                      F.lower(F.trim(F.col("order_status"))))
          .dropDuplicates(["order_id"])
    )

    # order_purchase_timestamp is NOT NULL in schema — drop the handful of
    # source rows that don't have it.
    return df.filter(F.col("order_purchase_timestamp").isNotNull())
