"""
clean_sellers — Olist sellers dataset. Same shape as customers, simpler dedup.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("seller_id",              StringType(), nullable=False),
    StructField("seller_zip_code_prefix", StringType(), nullable=True),
    StructField("seller_city",            StringType(), nullable=True),
    StructField("seller_state",           StringType(), nullable=True),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "olist_sellers_dataset.csv", schema=SCHEMA)
    return (
        df
        .dropna(subset=["seller_id"])
        .withColumn("seller_city",  F.trim(F.col("seller_city")))
        .withColumn("seller_state", F.upper(F.trim(F.col("seller_state"))))
        .dropDuplicates(["seller_id"])
    )
