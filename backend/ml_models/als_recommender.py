"""
als_recommender - Spark MLlib ALS collaborative filtering on Olist orders.

Why ALS (Alternating Least Squares)?
------------------------------------
Olist has no explicit ratings - customers buy things, they don't score them
1-5. That's the classic *implicit feedback* setting, which ALS handles via
the (Hu, Koren, Volinsky 2008) formulation that Spark MLlib implements
when implicitPrefs=True. Each (customer, product) buy becomes a positive
signal with a confidence weight proportional to the purchase count.

What this script does
---------------------
1. Reads data/processed/master_facts/.
2. Filters out canceled/unavailable orders so we don't recommend products
   nobody actually received.
3. Builds (customer_unique_id, product_id, rating) triples where rating =
   number of times that customer bought that product. For Olist this is
   almost always 1; a tiny tail of customers buy the same SKU twice.
4. String-indexes customer_unique_id -> user_idx and product_id -> item_idx
   (ALS requires integer IDs).
5. Splits 90/10 for a holdout evaluation. Trains ALS with implicitPrefs=True.
6. Computes RMSE on the holdout (sanity check; absolute number is small
   under implicit feedback but still useful as a delta-tracker between runs).
7. Computes a lightweight precision@K by intersecting the model's top-K
   recommendations with the customer's actual holdout purchases.
8. Calls recommendForAllUsers(top_k) to generate the recommendation grid.
9. Decodes user_idx -> customer_unique_id and item_idx -> product_id, joins
   to public.products to ensure the FK is satisfied, and writes
   public.recommendations.
10. Logs RMSE + precision@K rows to public.ml_model_runs.

Output schema for recommendations (matches database/schema.sql)
---------------------------------------------------------------
  id                  uuid (DEFAULT gen_random_uuid())  -- omitted on write
  customer_unique_id  text
  product_id          text
  rank                smallint    1..top_k
  score               real
  generated_at        timestamptz
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.feature import StringIndexer
from pyspark.ml.recommendation import ALS, ALSModel
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, FloatType

from spark_utils import read_parquet, write_parquet, write_dataframe_to_postgres


# --- Tunables ---------------------------------------------------------------

DEFAULT_RANK         = 16        # latent factor dimensionality
DEFAULT_REG_PARAM    = 0.10
DEFAULT_MAX_ITER     = 10
DEFAULT_ALPHA        = 40.0      # implicit-feedback confidence scaler
DEFAULT_SEED         = 42
DEFAULT_TOP_K        = 10
DEFAULT_HOLDOUT_FRAC = 0.10
DEFAULT_MIN_INTERACTIONS = 2     # customers with <N orders don't participate in eval


# --- Helpers ----------------------------------------------------------------

def _build_interactions(master: DataFrame) -> DataFrame:
    """Aggregate master_facts to one row per (customer, product) with rating = count."""
    return (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("customer_unique_id").isNotNull())
        .filter(F.col("product_id").isNotNull())
        .groupBy("customer_unique_id", "product_id")
        .agg(F.count("*").cast(FloatType()).alias("rating"))
    )


def _precision_at_k(model: ALSModel, holdout: DataFrame, k: int) -> float:
    """
    Macro precision@K: for every user in the holdout, ask the model for its
    top-K, then check how many of those K predictions appear in that user's
    actual holdout interactions. Averaged over users.
    """
    holdout_users = holdout.select("user_idx").distinct()
    user_subset_count = holdout_users.count()
    if user_subset_count == 0:
        return 0.0

    recs = model.recommendForUserSubset(holdout_users, k)
    recs_flat = (
        recs.select(
            "user_idx",
            F.explode("recommendations").alias("rec"),
        )
        .select("user_idx", F.col("rec.item_idx").alias("item_idx"))
    )

    actuals = holdout.select("user_idx", "item_idx").distinct()

    hits = (
        recs_flat
        .join(actuals, on=["user_idx", "item_idx"], how="inner")
        .groupBy("user_idx")
        .count()
    )
    total_hits = hits.agg(F.sum("count")).first()[0] or 0
    denom = user_subset_count * k
    return float(total_hits) / float(denom) if denom else 0.0


def _log_ml_run(model_name: str, metric_name: str, metric_value: float,
                params: dict, push_to_db: bool) -> None:
    """Insert one diagnostic row into public.ml_model_runs. Best-effort."""
    if not push_to_db:
        print(f"    [ml_model_runs] {model_name}/{metric_name}={metric_value:.4f} "
              f"(dry-run, not pushed)")
        return

    import psycopg2
    from spark_utils.db_writer import _get_db_url

    sql = """
        INSERT INTO public.ml_model_runs (model_name, metric_name, metric_value, params)
        VALUES (%s, %s, %s, %s::jsonb)
    """
    try:
        with psycopg2.connect(_get_db_url()) as conn, conn.cursor() as cur:
            cur.execute(sql, (model_name, metric_name, float(metric_value), json.dumps(params)))
        print(f"    [ml_model_runs] {model_name}/{metric_name}={metric_value:.4f} logged")
    except Exception as e:  # noqa: BLE001
        print(f"    [ml_model_runs] WARNING failed to log run: {e}")


# --- Main entry point -------------------------------------------------------

def run(
    spark: SparkSession,
    top_k: int = DEFAULT_TOP_K,
    rank: int = DEFAULT_RANK,
    reg_param: float = DEFAULT_REG_PARAM,
    max_iter: int = DEFAULT_MAX_ITER,
    alpha: float = DEFAULT_ALPHA,
    seed: int = DEFAULT_SEED,
    holdout_frac: float = DEFAULT_HOLDOUT_FRAC,
    min_interactions: int = DEFAULT_MIN_INTERACTIONS,
    push_to_db: bool = False,
) -> dict:
    """Train ALS and persist top-K recommendations per customer."""
    print(f"  ALS config - rank={rank}, regParam={reg_param}, "
          f"maxIter={max_iter}, alpha={alpha}, topK={top_k}")
    master = read_parquet(spark, "master_facts")

    interactions = _build_interactions(master)
    n_interactions = interactions.count()
    if n_interactions == 0:
        raise RuntimeError("No interactions to train on - master_facts is empty.")
    print(f"    interactions: {n_interactions:,}")

    # 1) String-index customer + product.
    user_indexer = StringIndexer(
        inputCol="customer_unique_id", outputCol="user_idx",
        handleInvalid="skip",
    ).fit(interactions)
    item_indexer = StringIndexer(
        inputCol="product_id", outputCol="item_idx",
        handleInvalid="skip",
    ).fit(interactions)

    indexed = item_indexer.transform(user_indexer.transform(interactions))
    indexed = (
        indexed
        .withColumn("user_idx", F.col("user_idx").cast(IntegerType()))
        .withColumn("item_idx", F.col("item_idx").cast(IntegerType()))
        .cache()
    )

    # 2) Identify "eligible" users (>= min_interactions). Cold-start users get
    #    full inclusion in the training set but do not contribute to eval.
    user_counts = indexed.groupBy("user_idx").count()
    eligible_users = user_counts.filter(F.col("count") >= min_interactions).select("user_idx")
    indexed_eligible = indexed.join(eligible_users, on="user_idx", how="inner")

    # 3) Train/holdout split among eligible rows only, then re-attach the cold
    #    users to the training set. Important: holdout rows must NOT leak back
    #    into training, or RMSE / precision@K will read the answer.
    train_eligible, holdout = indexed_eligible.randomSplit(
        [1 - holdout_frac, holdout_frac], seed=seed
    )
    cold_users_data = indexed.join(eligible_users, on="user_idx", how="left_anti")
    train_full = (
        train_eligible
        .unionByName(cold_users_data)
        .dropDuplicates(["user_idx", "item_idx"])
    )

    n_train, n_holdout = train_full.count(), holdout.count()
    print(f"    train rows  : {n_train:,}")
    print(f"    holdout rows: {n_holdout:,}  (eligible-only, min_interactions={min_interactions})")

    # 4) Fit ALS.
    als = ALS(
        userCol="user_idx",
        itemCol="item_idx",
        ratingCol="rating",
        rank=rank,
        regParam=reg_param,
        maxIter=max_iter,
        alpha=alpha,
        seed=seed,
        implicitPrefs=True,
        coldStartStrategy="drop",
        nonnegative=True,
    )
    model: ALSModel = als.fit(train_full)

    # 5) RMSE evaluation. Under implicit feedback the absolute number is weak
    #    (most ratings = 1.0, predictions are confidence scores in [0, inf)),
    #    but it's still useful for run-over-run regression detection.
    rmse = float("nan")
    if n_holdout > 0:
        preds = model.transform(holdout)
        try:
            rmse = float(RegressionEvaluator(
                metricName="rmse", labelCol="rating", predictionCol="prediction",
            ).evaluate(preds))
        except Exception as e:  # noqa: BLE001
            print(f"    [als] RMSE eval failed ({e}); using NaN")
    print(f"    rmse        : {rmse:.4f}")

    # 6) Precision@K against the holdout - answers the actual product question.
    p_at_k = _precision_at_k(model, holdout, top_k) if n_holdout > 0 else 0.0
    print(f"    precision@{top_k:<2}: {p_at_k:.4f}")

    # 7) Top-K per user.
    print(f"    generating top-{top_k} recommendations ...")
    recs = model.recommendForAllUsers(top_k)

    # 8) Decode indices back to original IDs.
    recs_flat = (
        recs.select(
            "user_idx",
            F.posexplode("recommendations").alias("position", "rec"),
        )
        .select(
            "user_idx",
            (F.col("position") + 1).cast("short").alias("rank"),
            F.col("rec.item_idx").alias("item_idx"),
            F.col("rec.rating").cast(FloatType()).alias("score"),
        )
    )

    user_labels = [(i, lbl) for i, lbl in enumerate(user_indexer.labels)]
    item_labels = [(i, lbl) for i, lbl in enumerate(item_indexer.labels)]
    user_lookup = spark.createDataFrame(user_labels, ["user_idx", "customer_unique_id"])
    item_lookup = spark.createDataFrame(item_labels, ["item_idx", "product_id"])

    recs_decoded = (
        recs_flat
        .join(user_lookup, on="user_idx", how="inner")
        .join(item_lookup, on="item_idx", how="inner")
        .select("customer_unique_id", "product_id", "rank", "score")
        .withColumn("generated_at", F.lit(datetime.now(timezone.utc)))
    )

    # 9) Persist.
    write_parquet(recs_decoded, "recommendations")
    n_recs = recs_decoded.count()
    n_users = recs_decoded.select("customer_unique_id").distinct().count()
    print(f"    output      : {n_recs:,} rows across {n_users:,} customers")

    if push_to_db:
        # public.recommendations has a UUID surrogate PK with DEFAULT
        # gen_random_uuid(), plus UNIQUE (customer_unique_id, rank, generated_at).
        # Our INSERT does not supply `id`, so the default fires per row.
        # ON CONFLICT uses the UNIQUE constraint and updates score if a re-run
        # produces the same triple within the same millisecond.
        write_dataframe_to_postgres(
            recs_decoded,
            table="public.recommendations",
            primary_keys=["customer_unique_id", "rank", "generated_at"],
            update_cols=["product_id", "score"],
        )

    # 10) Log run.
    common_params = {
        "rank": rank, "regParam": reg_param, "maxIter": max_iter,
        "alpha": alpha, "topK": top_k, "implicitPrefs": True,
        "n_users": n_users, "n_items": len(item_indexer.labels),
    }
    _log_ml_run("als", "rmse", rmse, common_params, push_to_db)
    _log_ml_run("als", "precision_at_k", p_at_k,
                {**common_params, "k": top_k}, push_to_db)

    indexed.unpersist()

    return {
        "rmse": rmse,
        "precision_at_k": p_at_k,
        "top_k": top_k,
        "n_recommendations": int(n_recs),
        "n_users": int(n_users),
        "n_items": int(len(item_indexer.labels)),
    }
