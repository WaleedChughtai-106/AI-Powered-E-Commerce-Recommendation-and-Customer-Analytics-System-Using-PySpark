"""
kmeans_segmentation — Spark MLlib K-Means on the RFM feature table.

What this script does
─────────────────────
1. Reads `data/processed/customer_features/` (produced by Phase 6
   feature_engineering.compute_rfm).
2. Standardises the [recency_days, frequency, monetary] vector — without
   scaling, `monetary` (range 0 – several thousand) dominates `frequency`
   (range 1 – 20-ish) and the K-Means cost function collapses onto the
   monetary axis. After StandardScaler each feature has unit variance and
   the clusters are driven by all three dimensions.
3. Trains a K-Means model with k=4. k=4 is chosen because:
     - the project narrative wants four named segments (VIP / Loyal /
       At Risk / New),
     - elbow / silhouette scans on the Olist data plateau around k=4–5,
     - more clusters become hard to assign meaningful names to.
   The script also computes the silhouette score for the chosen k and
   logs it to ml_model_runs so the "AI Insights" page can show the
   model's quality.
4. Maps each cluster_id → human label by inspecting the *original-scale*
   centroid coordinates. We never hard-code which integer label is the
   "VIP" cluster — that depends on K-Means' random initialisation. The
   mapping is recomputed every run, deterministically:
       - VIP     → highest composite value score  (-R_z + F_z + M_z)
       - At Risk → highest standardised recency   (largest R_z)
       - New     → lowest standardised frequency  (smallest F_z)
       - Loyal   → whichever cluster is left
   This is robust to k=3 (one of the named segments will simply be
   missing) but optimised for k=4.
5. Writes `customer_segments` (one row per customer) and inserts one
   ml_model_runs row with the silhouette score and hyper-parameters.

Output schema for customer_segments
───────────────────────────────────
  customer_unique_id     text PK
  cluster_id             smallint (0..k-1)
  segment_label          'VIP' | 'Loyal' | 'At Risk' | 'New'
  distance_to_centroid   double precision    -- Euclidean in standardised space
  assigned_at            timestamptz
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from typing import Dict, Tuple

from pyspark.ml.clustering import KMeans, KMeansModel
from pyspark.ml.evaluation import ClusteringEvaluator
from pyspark.ml.feature import StandardScaler, VectorAssembler
from pyspark.ml.linalg import DenseVector
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType

from spark_utils import read_parquet, write_parquet, write_dataframe_to_postgres


# ─── Tunables ─────────────────────────────────────────────────────────────────

FEATURE_COLS = ["recency_days", "frequency", "monetary"]
DEFAULT_K    = 4
DEFAULT_SEED = 42
DEFAULT_MAX_ITER = 30


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _euclidean(a: DenseVector, b: DenseVector) -> float:
    """Plain Euclidean distance between two Spark DenseVectors."""
    return float(math.sqrt(sum((float(x) - float(y)) ** 2 for x, y in zip(a, b))))


def _label_clusters(centroids_std: list[DenseVector]) -> Dict[int, str]:
    """
    Decide which integer cluster_id is VIP, Loyal, At Risk, New based on the
    standardised centroid coordinates.

    Parameters
    ----------
    centroids_std : list of DenseVector
        Centroids in *standardised* space, ordered by cluster_id 0..k-1.
        Each vector is (recency_z, frequency_z, monetary_z).

    Returns
    -------
    dict cluster_id → segment_label
    """
    k = len(centroids_std)

    # Composite "value" score: low recency is good (so negate), high freq + high monetary is good.
    # Highest value_score → VIP.
    value_scores = {
        cid: (-float(c[0])) + float(c[1]) + float(c[2])
        for cid, c in enumerate(centroids_std)
    }
    vip_id = max(value_scores, key=value_scores.get)

    # At Risk: highest standardised recency, excluding VIP.
    recency_scores = {cid: float(c[0]) for cid, c in enumerate(centroids_std) if cid != vip_id}
    at_risk_id = max(recency_scores, key=recency_scores.get) if recency_scores else None

    # New: lowest standardised frequency among the still-unlabelled clusters.
    remaining = {cid: c for cid, c in enumerate(centroids_std) if cid not in {vip_id, at_risk_id}}
    if remaining:
        freq_scores = {cid: float(c[1]) for cid, c in remaining.items()}
        new_id = min(freq_scores, key=freq_scores.get)
    else:
        new_id = None

    mapping: Dict[int, str] = {}
    mapping[vip_id] = "VIP"
    if at_risk_id is not None:
        mapping[at_risk_id] = "At Risk"
    if new_id is not None:
        mapping[new_id] = "New"
    # Everything left over is Loyal.
    for cid in range(k):
        mapping.setdefault(cid, "Loyal")

    return mapping


def _log_ml_run(
    model_name: str,
    metric_name: str,
    metric_value: float,
    params: dict,
    push_to_db: bool,
) -> None:
    """Insert a row into public.ml_model_runs. Best-effort: prints on failure."""
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


# ─── Main entry point ────────────────────────────────────────────────────────

def run(
    spark: SparkSession,
    k: int = DEFAULT_K,
    seed: int = DEFAULT_SEED,
    max_iter: int = DEFAULT_MAX_ITER,
    push_to_db: bool = False,
) -> dict:
    """
    Train K-Means, assign segments, persist results.

    Returns a small dict with diagnostic metrics: silhouette, cluster_sizes,
    cluster_label_mapping. Used by the orchestrator's summary print-out.
    """
    print(f"  KMeans config — k={k}, seed={seed}, max_iter={max_iter}")
    features_df = read_parquet(spark, "customer_features")
    n_in = features_df.count()
    if n_in == 0:
        raise RuntimeError(
            "customer_features Parquet is empty. Re-run preprocessing first."
        )
    print(f"    input rows: {n_in:,}")

    # Cast to double so VectorAssembler is happy (monetary is Decimal).
    features_typed = features_df.select(
        "customer_unique_id",
        *[F.col(c).cast(DoubleType()).alias(c) for c in FEATURE_COLS],
    )

    # 1) Assemble + standardise.
    assembler = VectorAssembler(inputCols=FEATURE_COLS, outputCol="features_raw")
    assembled = assembler.transform(features_typed)

    scaler = StandardScaler(
        inputCol="features_raw",
        outputCol="features",
        withMean=True,
        withStd=True,
    )
    scaler_model = scaler.fit(assembled)
    scaled = scaler_model.transform(assembled).cache()

    # 2) Fit K-Means.
    kmeans = KMeans(featuresCol="features", predictionCol="cluster_id",
                    k=k, seed=seed, maxIter=max_iter)
    model: KMeansModel = kmeans.fit(scaled)
    predictions = model.transform(scaled).cache()

    # 3) Silhouette evaluation (squared Euclidean on the standardised vector).
    evaluator = ClusteringEvaluator(
        featuresCol="features", predictionCol="cluster_id",
        metricName="silhouette", distanceMeasure="squaredEuclidean",
    )
    try:
        silhouette = float(evaluator.evaluate(predictions))
    except Exception as e:  # noqa: BLE001
        # Silhouette occasionally chokes on tiny clusters; fall back to NaN
        # rather than break the whole pipeline.
        print(f"    [kmeans] silhouette eval failed ({e}); using NaN")
        silhouette = float("nan")
    print(f"    silhouette score: {silhouette:.4f}")

    # 4) Label clusters from standardised centroids.
    std_centroids = model.clusterCenters()  # list[np.ndarray] in standardised space
    label_mapping = _label_clusters([DenseVector(c) for c in std_centroids])
    print(f"    label mapping  : {label_mapping}")

    # Project centroids back to original space for the viva crib.
    means = scaler_model.mean        # column means
    stds  = scaler_model.std         # column std-devs (with withStd=True)
    orig_centroids = [
        [float(m) + float(s) * float(z) for m, s, z in zip(means, stds, c)]
        for c in std_centroids
    ]
    for cid, c in enumerate(orig_centroids):
        print(f"      cluster {cid} [{label_mapping[cid]:<7}] "
              f"R={c[0]:6.1f}  F={c[1]:5.2f}  M={c[2]:9.2f}")

    # 5) Per-row distance to its centroid (Euclidean in standardised space).
    #
    # We deliberately AVOID a Python UDF here. On Windows + Spark 3.5 + Java 17,
    # a UDF that closes over a Broadcast variable holding DenseVectors crashes
    # the Python worker mid-task with `Python worker exited unexpectedly`
    # (EOFException on the JVM side). The fix is to keep the compute fully in
    # the JVM via Spark SQL primitives:
    #   - vector_to_array("features")   turns the Vector column into an array
    #   - F.when chains map cluster_id -> the cluster's centroid coordinate
    #     for each dimension
    #   - the squared-Euclidean sum + sqrt happens with column arithmetic.
    from pyspark.ml.functions import vector_to_array

    n_dims = len(std_centroids[0])

    def _centroid_coord(dim: int):
        """Return a Column expression: cluster_id -> centroid[dim]."""
        expr = None
        for cid, c in enumerate(std_centroids):
            val = F.lit(float(c[dim]))
            cond = F.col("cluster_id") == F.lit(int(cid))
            expr = F.when(cond, val) if expr is None else expr.when(cond, val)
        return expr

    label_map_expr = F.create_map(
        *[item for cid, lbl in label_mapping.items()
          for item in (F.lit(int(cid)), F.lit(lbl))]
    )

    predictions_arr = predictions.withColumn(
        "_feat_arr", vector_to_array(F.col("features"))
    )

    # Sum of (feat[d] - centroid[d])^2 over all dimensions, then sqrt.
    squared = None
    for d in range(n_dims):
        term = F.pow(F.col("_feat_arr")[d] - _centroid_coord(d), F.lit(2.0))
        squared = term if squared is None else squared + term

    segments = (
        predictions_arr
        .withColumn("distance_to_centroid", F.sqrt(squared))
        .withColumn("segment_label",        label_map_expr[F.col("cluster_id")])
        .withColumn("cluster_id",           F.col("cluster_id").cast("short"))
        .withColumn("assigned_at",          F.lit(datetime.now(timezone.utc)))
        .select(
            "customer_unique_id",
            "cluster_id",
            "segment_label",
            "distance_to_centroid",
            "assigned_at",
        )
    )

    # 6) Persist results.
    write_parquet(segments, "customer_segments")

    cluster_sizes = (
        segments.groupBy("segment_label").count().orderBy(F.desc("count")).collect()
    )
    print("    cluster sizes:")
    for row in cluster_sizes:
        print(f"      {row['segment_label']:<8}: {row['count']:,}")

    if push_to_db:
        write_dataframe_to_postgres(
            segments,
            table="public.customer_segments",
            primary_keys=["customer_unique_id"],
        )

    # 7) Log the run.
    _log_ml_run(
        model_name="kmeans",
        metric_name="silhouette",
        metric_value=silhouette,
        params={
            "k": k,
            "seed": seed,
            "max_iter": max_iter,
            "features": FEATURE_COLS,
            "label_mapping": {str(c): l for c, l in label_mapping.items()},
        },
        push_to_db=push_to_db,
    )

    # 8) Cleanup cached frames.
    predictions.unpersist()
    scaled.unpersist()

    return {
        "silhouette": silhouette,
        "k": k,
        "label_mapping": label_mapping,
        "cluster_sizes": {r["segment_label"]: int(r["count"]) for r in cluster_sizes},
        "n_customers": int(n_in),
    }