"""
clean_order_reviews — customer review per order.

Quirks of the source
────────────────────
- Review comments contain literal newlines inside the quoted text, so the
  CSV must be read with multiLine=True (handled by io_utils.read_csv).
- review_id is NOT unique across the dataset — the same review_id can appear
  attached to multiple orders. The composite (review_id, order_id) is what
  the schema treats as the PK.
- Some rows have invalid review_score values; we clip to [1, 5] via filter.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    IntegerType,
    StringType,
    StructField,
    StructType,
)

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("review_id",               StringType(),  nullable=False),
    StructField("order_id",                StringType(),  nullable=False),
    StructField("review_score",            IntegerType(), nullable=False),
    StructField("review_comment_title",    StringType(),  nullable=True),
    StructField("review_comment_message",  StringType(),  nullable=True),
    StructField("review_creation_date",    StringType(),  nullable=True),
    StructField("review_answer_timestamp", StringType(),  nullable=True),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(
        spark,
        "olist_order_reviews_dataset.csv",
        schema=SCHEMA,
        multi_line=True,
    )

    return (
        df
        .dropna(subset=["review_id", "order_id", "review_score"])
        .filter((F.col("review_score") >= 1) & (F.col("review_score") <= 5))
        .withColumn("review_creation_date",
                    F.to_timestamp(F.col("review_creation_date"),
                                   "yyyy-MM-dd HH:mm:ss"))
        .withColumn("review_answer_timestamp",
                    F.to_timestamp(F.col("review_answer_timestamp"),
                                   "yyyy-MM-dd HH:mm:ss"))
        .dropDuplicates(["review_id", "order_id"])
    )
