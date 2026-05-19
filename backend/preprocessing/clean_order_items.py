"""
clean_order_items — line items inside each order.

A single order can have multiple items; (order_id, order_item_id) is the
composite primary key. order_item_id is 1..N within the order, not a global
identifier.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    DecimalType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("order_id",            StringType(),       nullable=False),
    StructField("order_item_id",       IntegerType(),      nullable=False),
    StructField("product_id",          StringType(),       nullable=False),
    StructField("seller_id",           StringType(),       nullable=False),
    StructField("shipping_limit_date", StringType(),       nullable=True),
    StructField("price",               DecimalType(12, 2), nullable=False),
    StructField("freight_value",       DecimalType(12, 2), nullable=False),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "olist_order_items_dataset.csv", schema=SCHEMA)

    return (
        df
        .dropna(subset=["order_id", "order_item_id", "product_id", "seller_id"])
        .withColumn("shipping_limit_date",
                    F.to_timestamp(F.col("shipping_limit_date"),
                                   "yyyy-MM-dd HH:mm:ss"))
        # Negative prices / freight don't exist in the source but the CHECK
        # constraint in Postgres rejects them — guard anyway.
        .filter((F.col("price") >= 0) & (F.col("freight_value") >= 0))
        .dropDuplicates(["order_id", "order_item_id"])
    )
