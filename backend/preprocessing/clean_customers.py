"""
clean_customers — Olist customers dataset.

Input  : data/raw/olist_customers_dataset.csv
Output : DataFrame matching public.customers in Supabase

Cleaning steps
──────────────
1. Apply explicit schema (string types only — zip codes have leading zeros).
2. Drop rows missing customer_id (PK) or customer_unique_id (segmentation key).
3. Trim whitespace on city / state.
4. Uppercase customer_state to match the char(2) CHECK in Postgres.
5. Deduplicate by customer_id (the source has none, but it's cheap insurance).
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("customer_id",              StringType(), nullable=False),
    StructField("customer_unique_id",       StringType(), nullable=False),
    StructField("customer_zip_code_prefix", StringType(), nullable=True),
    StructField("customer_city",            StringType(), nullable=True),
    StructField("customer_state",           StringType(), nullable=True),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "olist_customers_dataset.csv", schema=SCHEMA)
    return (
        df
        .dropna(subset=["customer_id", "customer_unique_id"])
        .withColumn("customer_city",  F.trim(F.col("customer_city")))
        .withColumn("customer_state", F.upper(F.trim(F.col("customer_state"))))
        .dropDuplicates(["customer_id"])
    )
