"""
clean_categories — Portuguese → English category translation.

The Olist file is `product_category_name_translation.csv` (note: no
`olist_` prefix, which is the dataset's quirk).
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from spark_utils.io_utils import read_csv

SCHEMA = StructType([
    StructField("product_category_name",         StringType(), nullable=False),
    StructField("product_category_name_english", StringType(), nullable=False),
])


def clean(spark: SparkSession) -> DataFrame:
    df = read_csv(spark, "product_category_name_translation.csv", schema=SCHEMA)
    return (
        df
        .dropna(subset=["product_category_name"])
        .withColumn("product_category_name",
                    F.lower(F.trim(F.col("product_category_name"))))
        .withColumn("product_category_name_english",
                    F.lower(F.trim(F.col("product_category_name_english"))))
        .dropDuplicates(["product_category_name"])
    )


def augment_with_missing(categories: DataFrame, products: DataFrame) -> DataFrame:
    """
    Patch a well-known Olist data-quality gap.

    The shipped `product_category_name_translation.csv` is missing English
    translations for a couple of categories that DO appear in the products
    file (commonly `pc_gamer` and `portateis_cozinha_e_preparadores_de_alimentos`).
    Inserting those products into Supabase without first inserting matching
    category rows violates the FK `products_product_category_name_fkey`.

    This helper returns a categories DataFrame that is a *superset* of the
    product categories: every product.product_category_name is guaranteed
    to exist. The English label for synthesised rows is just the Portuguese
    name with underscores replaced by spaces — good enough for display and
    keeps the schema constraints happy.

    Both inputs are expected to come from clean_categories.clean() and
    clean_products.clean(), which lowercase + trim the category name, so
    the set operations below match correctly.
    """
    product_cats = (
        products
        .select("product_category_name")
        .dropna()
        .distinct()
    )
    existing_cats = categories.select("product_category_name").distinct()

    # Categories referenced by products but absent from the translation file.
    missing = product_cats.subtract(existing_cats)

    # Synthesise an English label.
    synthesised = missing.withColumn(
        "product_category_name_english",
        F.regexp_replace(F.col("product_category_name"), "_", " "),
    )

    # unionByName so column order doesn't matter; dropDuplicates is belt &
    # braces in case the user re-runs after a partial push.
    return categories.unionByName(synthesised).dropDuplicates(["product_category_name"])
