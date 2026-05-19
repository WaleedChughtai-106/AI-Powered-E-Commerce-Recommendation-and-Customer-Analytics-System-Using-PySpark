"""
run_ml_pipeline.py — Phase 7 orchestrator.

Reads the Phase 6 Parquet outputs (data/processed/{master_facts,customer_features})
and produces:

    1. K-Means customer segmentation   → public.customer_segments
    2. ALS product recommendations     → public.recommendations
    3. Daily KPI snapshots             → public.kpi_snapshots
    4. Per-product metrics             → public.product_metrics
    5. Per-category metrics            → Parquet only (debug artefact)
    6. (Optional) sklearn sales forecast → public.sales_forecasts

Each ML model logs one or more rows into public.ml_model_runs so the
"AI Insights" dashboard page surfaces silhouette / precision@10 / RMSE / R².

Run from backend/ with:
    python -m scripts.run_ml_pipeline
    python -m scripts.run_ml_pipeline --push-to-db
    python -m scripts.run_ml_pipeline --push-to-db --skip-forecast
    python -m scripts.run_ml_pipeline --only-kmeans  --push-to-db
    python -m scripts.run_ml_pipeline --only-als     --push-to-db
    python -m scripts.run_ml_pipeline --only-analytics --push-to-db
    python -m scripts.run_ml_pipeline --only-forecast --push-to-db
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


# ─── Path setup (must happen before our imports) ─────────────────────────────
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

load_dotenv(_BACKEND_ROOT / ".env")

from spark_utils import get_spark, read_parquet, write_parquet, write_dataframe_to_postgres  # noqa: E402
from spark_utils.spark_session import stop_spark  # noqa: E402
from pyspark.sql import functions as F  # noqa: E402

from ml_models import kmeans_segmentation, als_recommender, sales_forecast  # noqa: E402
from analytics import revenue_analytics, customer_analytics, product_analytics, category_analytics  # noqa: E402


# ─── Argparse ────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Phase 7 ML + analytics pipeline.")
    p.add_argument("--push-to-db", action="store_true",
                   help="Upsert all analytics tables (and ml_model_runs) into Supabase.")
    p.add_argument("--skip-forecast", action="store_true",
                   help="Skip the optional scikit-learn sales forecaster.")
    p.add_argument("--only-kmeans",    action="store_true",
                   help="Run only the K-Means segmentation step.")
    p.add_argument("--only-als",       action="store_true",
                   help="Run only the ALS recommender step.")
    p.add_argument("--only-analytics", action="store_true",
                   help="Run only the analytics aggregations (kpi_snapshots + product_metrics).")
    p.add_argument("--only-forecast",  action="store_true",
                   help="Run only the scikit-learn sales forecast.")

    # K-Means tuning
    p.add_argument("--k",              type=int, default=4,   help="K-Means k (default 4).")
    p.add_argument("--kmeans-seed",    type=int, default=42)
    p.add_argument("--kmeans-max-iter", type=int, default=30)

    # ALS tuning
    p.add_argument("--als-rank",      type=int,   default=16)
    p.add_argument("--als-reg",       type=float, default=0.10)
    p.add_argument("--als-max-iter",  type=int,   default=10)
    p.add_argument("--als-alpha",     type=float, default=40.0)
    p.add_argument("--top-k",         type=int,   default=10,
                   help="Recommendations per customer (default 10).")

    # Forecast tuning
    p.add_argument("--forecast-model",   choices=["randomforest", "linreg"],
                   default="randomforest")
    p.add_argument("--forecast-horizon", type=int, default=30)
    p.add_argument("--forecast-holdout", type=int, default=30)
    return p.parse_args()


def _no_only_flags(args: argparse.Namespace) -> bool:
    return not (args.only_kmeans or args.only_als or args.only_analytics or args.only_forecast)


# ─── KPI snapshot writer ─────────────────────────────────────────────────────

def _build_kpi_snapshots(spark, push_to_db: bool) -> dict:
    """
    Compose revenue_analytics + customer_analytics into kpi_snapshots-shaped rows.
    """
    master = read_parquet(spark, "master_facts")

    rev  = revenue_analytics.compute(master)         # snapshot_date + revenue/orders/aov
    cust = customer_analytics.compute(master)        # snapshot_date + customers/active/repeat

    snapshots = (
        rev.join(cust, on="snapshot_date", how="left")
           .fillna({"total_customers": 0, "active_customers": 0})
           .withColumn(
               "repeat_rate",
               F.coalesce(F.col("repeat_rate"), F.lit(0.0).cast("decimal(5,4)")),
           )
           .withColumn("computed_at", F.lit(datetime.now(timezone.utc)))
           .select(
               "snapshot_date",
               "total_revenue",
               "total_orders",
               "total_customers",
               "active_customers",
               "avg_order_value",
               "repeat_rate",
               "computed_at",
           )
    )

    write_parquet(snapshots, "kpi_snapshots")
    n = snapshots.count()
    print(f"    kpi_snapshots: {n:,} daily rows")

    if push_to_db:
        write_dataframe_to_postgres(
            snapshots,
            table="public.kpi_snapshots",
            primary_keys=["snapshot_date"],
        )
    return {"n_rows": int(n)}


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()
    t0 = time.time()

    run_all = _no_only_flags(args)

    print("═════════════════════════════════════════════════════════════════")
    print("  Quantuma AI — Phase 7 ML + analytics pipeline")
    print("═════════════════════════════════════════════════════════════════")
    print(f"  push-to-db    : {args.push_to_db}")
    print(f"  skip-forecast : {args.skip_forecast}")
    if not run_all:
        flags = [n for n in ("only_kmeans", "only_als", "only_analytics", "only_forecast")
                 if getattr(args, n)]
        print(f"  selective     : {', '.join(flags)}")
    print(f"  backend root  : {_BACKEND_ROOT}")
    print()

    spark = get_spark(app_name="quantuma-ml")
    summary: dict = {}
    try:
        # ─── K-Means ───────────────────────────────────────────────────────
        if run_all or args.only_kmeans:
            print("Step 1 — K-Means customer segmentation")
            print("──────────────────────────────────────")
            summary["kmeans"] = kmeans_segmentation.run(
                spark,
                k=args.k,
                seed=args.kmeans_seed,
                max_iter=args.kmeans_max_iter,
                push_to_db=args.push_to_db,
            )
            print()

        # ─── ALS ───────────────────────────────────────────────────────────
        if run_all or args.only_als:
            print("Step 2 — ALS recommendations")
            print("────────────────────────────")
            summary["als"] = als_recommender.run(
                spark,
                top_k=args.top_k,
                rank=args.als_rank,
                reg_param=args.als_reg,
                max_iter=args.als_max_iter,
                alpha=args.als_alpha,
                push_to_db=args.push_to_db,
            )
            print()

        # ─── Analytics ─────────────────────────────────────────────────────
        if run_all or args.only_analytics:
            print("Step 3 — Analytics aggregations")
            print("───────────────────────────────")
            summary["kpi_snapshots"]    = _build_kpi_snapshots(spark, args.push_to_db)
            summary["product_metrics"]  = product_analytics.run(spark, push_to_db=args.push_to_db)
            summary["category_metrics"] = category_analytics.run(spark, push_to_db=args.push_to_db)
            print()

        # ─── Forecast (optional) ───────────────────────────────────────────
        do_forecast = (run_all and not args.skip_forecast) or args.only_forecast
        if do_forecast:
            print("Step 4 — Sales forecast (scikit-learn)")
            print("──────────────────────────────────────")
            try:
                summary["forecast"] = sales_forecast.run(
                    spark,
                    horizon=args.forecast_horizon,
                    holdout_days=args.forecast_holdout,
                    model_name=args.forecast_model,
                    push_to_db=args.push_to_db,
                )
            except Exception as e:  # noqa: BLE001
                # The forecast is explicitly optional — don't blow up the whole
                # run if the daily series is too short or sklearn is missing.
                import traceback
                print(f"    [forecast] failed: {e}")
                traceback.print_exc()
                summary["forecast"] = {"error": str(e)}
            print()

        # ─── Summary ───────────────────────────────────────────────────────
        elapsed = time.time() - t0
        print("═════════════════════════════════════════════════════════════════")
        print(f"✓ Phase 7 complete in {elapsed:0.1f}s")
        print("═════════════════════════════════════════════════════════════════")
        for k, v in summary.items():
            print(f"  {k:<18}: {v}")
        return 0

    except FileNotFoundError as e:
        print(f"\n✗ Missing Parquet input — did you run scripts/run_preprocessing.py?\n  {e}\n")
        return 2

    except Exception:  # noqa: BLE001
        import traceback
        print("\n✗ ML pipeline failed:")
        traceback.print_exc()
        return 1

    finally:
        stop_spark()


if __name__ == "__main__":
    sys.exit(main())
