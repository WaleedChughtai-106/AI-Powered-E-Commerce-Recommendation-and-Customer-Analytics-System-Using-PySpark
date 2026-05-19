"""
clean_order_payments — split payments per order.

(order_id, payment_sequential) is the composite PK; an order may pay with
multiple instruments (e.g. partial voucher + credit_card).
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
    StructField("order_id",             StringType(),       nullable=False),
    StructField("payment_sequential",   IntegerType(),      nullable=False),
    StructField("payment_type",         StringType(),       nullable=True),
    StructField("payment_installments", IntegerType(),      nullable=False),
    StructField("payment_value",        DecimalType(12, 2), nullable=False),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "olist_order_payments_dataset.csv", schema=SCHEMA)
    return (
        df
        .dropna(subset=["order_id", "payment_sequential"])
        .withColumn("payment_type",
                    F.lower(F.trim(F.col("payment_type"))))
        .filter((F.col("payment_value") >= 0) &
                (F.col("payment_installments") >= 0))
        .dropDuplicates(["order_id", "payment_sequential"])
    )
