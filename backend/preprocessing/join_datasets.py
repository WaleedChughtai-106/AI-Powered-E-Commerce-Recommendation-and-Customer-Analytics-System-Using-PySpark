"""
join_datasets — assemble the master analytical fact table.

The result is one row per (order_id, order_item_id) joined out to every
dimension we need downstream: customer (with stable customer_unique_id),
product (with English category label), seller, the order-level payment
aggregate, and the order-level review aggregate.

Why one wide table?
  - RFM feature engineering, K-Means scoring, ALS training, product metrics
    and category aggregates all start from this same shape. Computing the
    joins once amortises the cost.
  - Spark's Catalyst optimiser is happy with a wide fact table; the chart
    queries on Postgres still go through the narrow views in views.sql.

The returned DataFrame is NOT written back to Supabase directly — it's an
internal intermediate written to data/processed/master_facts/ in Parquet.
"""

from __future__ import annotations

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window


def join_master(
    spark: SparkSession,
    customers: DataFrame,
    orders: DataFrame,
    order_items: DataFrame,
    products: DataFrame,
    sellers: DataFrame,
    payments: DataFrame,
    reviews: DataFrame,
    categories: DataFrame,
) -> DataFrame:
    """
    Build the master fact DataFrame.

    Aggregation strategy
    --------------------
    - payments and reviews are aggregated to *order level* before the join.
      That keeps the master table at one row per line-item rather than
      exploding into a Cartesian product when an order has 3 payments
      and 1 review.
    """

    # 1) Aggregate payments to order level.
    #
    # Done in two passes because the "dominant payment type" is a window
    # function and Spark's analyser will not let you mix one inside a
    # groupBy().agg() — every non-aggregating column reference has to be in
    # the GROUP BY, and `first_value(... order by ...)` introduces
    # payment_type / payment_value references that aren't.
    #
    # Pass A: the straight sums + max.
    payments_basic = (
        payments.groupBy("order_id")
        .agg(
            F.sum("payment_value").alias("order_total_paid"),
            F.max("payment_installments").alias("payment_installments_max"),
        )
    )

    # Pass B: pick the canonical payment_type as the one with the biggest
    # payment_value within the order. row_number() over a value-desc window
    # is the standard "argmax" pattern in Spark.
    dominant_window = Window.partitionBy("order_id").orderBy(F.col("payment_value").desc())
    payments_dominant = (
        payments
        .withColumn("_rn", F.row_number().over(dominant_window))
        .filter(F.col("_rn") == 1)
        .select(
            "order_id",
            F.col("payment_type").alias("payment_type_dominant"),
        )
    )

    payments_agg = payments_basic.join(payments_dominant, on="order_id", how="left")

    # 2) Aggregate reviews to order level (some orders have 0, some 1+ reviews).
    reviews_agg = (
        reviews.groupBy("order_id")
        .agg(
            F.avg("review_score").alias("review_score_avg"),
            F.count("review_id").alias("review_count"),
        )
    )

    # 3) Enrich products with the English category name.
    products_enriched = (
        products
        .join(categories, on="product_category_name", how="left")
        .withColumn(
            "product_category_label",
            F.coalesce(F.col("product_category_name_english"),
                       F.col("product_category_name"),
                       F.lit("unknown")),
        )
        .select(
            "product_id",
            F.col("product_category_name").alias("category_pt"),
            F.col("product_category_label").alias("category"),
            "product_weight_g",
        )
    )

    # 4) Strip customer down to the columns we need (the unique key).
    customers_slim = customers.select(
        "customer_id", "customer_unique_id", "customer_city", "customer_state"
    )

    # 5) Strip seller similarly.
    sellers_slim = sellers.select(
        "seller_id", "seller_city", "seller_state"
    )

    # 6) The big join. Left joins so we never silently drop orders that
    #    happen to be missing a payment row, a review, or have a stale
    #    product reference.
    master = (
        order_items
        .join(orders,           on="order_id",  how="left")
        .join(customers_slim,   on="customer_id", how="left")
        .join(products_enriched, on="product_id", how="left")
        .join(sellers_slim,     on="seller_id", how="left")
        .join(payments_agg,     on="order_id",  how="left")
        .join(reviews_agg,      on="order_id",  how="left")
    )

    # 7) Derived columns the downstream steps reuse a lot.
    master = (
        master
        .withColumn("item_revenue",  F.col("price") + F.col("freight_value"))
        .withColumn("purchase_date", F.to_date(F.col("order_purchase_timestamp")))
        .withColumn("purchase_month",
                    F.date_trunc("month", F.col("order_purchase_timestamp")).cast("date"))
        .withColumn("is_canceled",
                    (F.col("order_status").isin("canceled", "unavailable")).cast("boolean"))
    )

    return master
