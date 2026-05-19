"""
clean_products — Olist products dataset.

Notes
─────
- The source file misspells `product_name_length` as `product_name_lenght`
  (and similar for `product_description_lenght`). We preserve the typo to
  match `database/schema.sql`.
- Null dimensions (weight / size) are kept as NULL rather than imputed —
  the dashboard's product cards tolerate them and imputation would create
  fake data that would mislead the analytics.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, StringType, StructField, StructType

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("product_id",                 StringType(),  nullable=False),
    StructField("product_category_name",      StringType(),  nullable=True),
    StructField("product_name_lenght",        IntegerType(), nullable=True),
    StructField("product_description_lenght", IntegerType(), nullable=True),
    StructField("product_photos_qty",         IntegerType(), nullable=True),
    StructField("product_weight_g",           IntegerType(), nullable=True),
    StructField("product_length_cm",          IntegerType(), nullable=True),
    StructField("product_height_cm",          IntegerType(), nullable=True),
    StructField("product_width_cm",           IntegerType(), nullable=True),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "olist_products_dataset.csv", schema=SCHEMA)
    return (
        df
        .dropna(subset=["product_id"])
        .withColumn("product_category_name",
                    F.lower(F.trim(F.col("product_category_name"))))
        .dropDuplicates(["product_id"])
    )
