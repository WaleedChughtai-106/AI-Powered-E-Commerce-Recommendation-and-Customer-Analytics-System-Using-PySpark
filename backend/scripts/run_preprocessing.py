"""
run_preprocessing.py — Phase 6 orchestrator.

Pipeline:
    Olist CSVs (data/raw/)
        ↓ clean_*  (one cleaner per source table)
    Cleaned per-table DataFrames
        ↓ write Parquet to data/processed/<table>/
        ↓ optional: upsert raw tables to Supabase (--push-to-db)
    join_datasets.join_master
        ↓ data/processed/master_facts/
    feature_engineering.compute_rfm
        ↓ data/processed/customer_features/
        ↓ optional: upsert public.customer_features (--push-to-db)

Run from backend/ with:
    python -m scripts.run_preprocessing
    python -m scripts.run_preprocessing --push-to-db
    python -m scripts.run_preprocessing --only-features   # skip raw cleaners
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv


# ─── Path setup ──────────────────────────────────────────────────────────────
# Add backend/ to sys.path so `import spark_utils` and `import preprocessing`
# resolve when this script is run as `python scripts/run_preprocessing.py`
# (i.e. without the -m flag).
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

load_dotenv(_BACKEND_ROOT / ".env")  # populates SUPABASE_DB_URL etc.

# Imports must come AFTER sys.path manipulation.
from spark_utils import (                       # noqa: E402
    get_spark, write_parquet, write_dataframe_to_postgres,
)
from spark_utils.io_utils import show_summary   # noqa: E402
from spark_utils.spark_session import stop_spark  # noqa: E402

from preprocessing import (                      # noqa: E402
    clean_customers,
    clean_sellers,
    clean_categories,
    clean_products,
    clean_orders,
    clean_order_items,
    clean_order_payments,
    clean_order_reviews,
)
from preprocessing.clean_categories import augment_with_missing  # noqa: E402
from preprocessing.join_datasets import join_master           # noqa: E402
from preprocessing.feature_engineering import compute_rfm     # noqa: E402


# ─── Table → (parquet name, postgres table, primary keys) lookup ─────────────
# Used by both the parquet writes and the optional Supabase push.
RAW_TABLES = [
    # (clean_module, parquet_dir_name, postgres_table_name, primary_keys)
    (clean_categories,      "categories",       "public.product_category_translation", ["product_category_name"]),
    (clean_sellers,         "sellers",          "public.sellers",                       ["seller_id"]),
    (clean_customers,       "customers",        "public.customers",                     ["customer_id"]),
    (clean_products,        "products",         "public.products",                      ["product_id"]),
    (clean_orders,          "orders",           "public.orders",                        ["order_id"]),
    (clean_order_items,     "order_items",      "public.order_items",                   ["order_id", "order_item_id"]),
    (clean_order_payments,  "order_payments",   "public.order_payments",                ["order_id", "payment_sequential"]),
    (clean_order_reviews,   "order_reviews",    "public.order_reviews",                 ["review_id", "order_id"]),
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Phase 6 preprocessing pipeline.")
    p.add_argument("--push-to-db", action="store_true",
                   help="Upsert cleaned raw tables AND customer_features into Supabase.")
    p.add_argument("--only-features", action="store_true",
                   help="Skip the raw cleaning step and recompute features from "
                        "the previously-saved master_facts Parquet.")
    p.add_argument("--skip-master", action="store_true",
                   help="Skip the join step (use already-saved master_facts).")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    t0 = time.time()

    print("═════════════════════════════════════════════════════════════════")
    print("  Quantuma AI — Phase 6 preprocessing pipeline")
    print("═════════════════════════════════════════════════════════════════")
    print(f"  push-to-db    : {args.push_to_db}")
    print(f"  only-features : {args.only_features}")
    print(f"  skip-master   : {args.skip_master}")
    print(f"  backend root  : {_BACKEND_ROOT}")
    print()

    spark = get_spark(app_name="quantuma-preprocessing")
    try:

        cleaned = {}

        # ── Step 1: clean each raw table ────────────────────────────────────
        if not args.only_features:
            print("Step 1 — cleaning raw tables")
            print("─────────────────────────────")
            for module, parquet_name, _pg_table, _pk in RAW_TABLES:
                df = module.clean(spark)
                cleaned[parquet_name] = df

                write_parquet(df, parquet_name)
                show_summary(df, parquet_name)

            # Patch a well-known Olist gap: a couple of product_category_name
            # values referenced by products are missing from the translation
            # file. Augment categories so the FK in Supabase is satisfied
            # (also benefits the join in Step 2: no rows fall through to
            # "unknown" because of missing translations).
            cleaned["categories"] = augment_with_missing(
                cleaned["categories"], cleaned["products"]
            )
            write_parquet(cleaned["categories"], "categories")
            show_summary(cleaned["categories"], "categories (augmented)")
            print()

            # ── Step 1b (optional): push cleaned raw tables to Supabase ─────
            if args.push_to_db:
                print("Step 1b — pushing cleaned raw tables to Supabase")
                print("────────────────────────────────────────────────")
                for module, parquet_name, pg_table, pk in RAW_TABLES:
                    write_dataframe_to_postgres(
                        cleaned[parquet_name],
                        table=pg_table,
                        primary_keys=pk,
                    )
                print()

        # ── Step 2: master fact table ───────────────────────────────────────
        if args.skip_master or args.only_features:
            print("Step 2 — skipping join (reading existing master_facts/)")
            from spark_utils import read_parquet
            master = read_parquet(spark, "master_facts")
        else:
            print("Step 2 — building master fact table")
            print("───────────────────────────────────")
            master = join_master(
                spark,
                customers   = cleaned["customers"],
                orders      = cleaned["orders"],
                order_items = cleaned["order_items"],
                products    = cleaned["products"],
                sellers     = cleaned["sellers"],
                payments    = cleaned["order_payments"],
                reviews     = cleaned["order_reviews"],
                categories  = cleaned["categories"],
            )
            write_parquet(master, "master_facts")
            show_summary(master, "master_facts")
        print()

        # ── Step 3: RFM feature engineering ─────────────────────────────────
        print("Step 3 — RFM feature engineering")
        print("─────────────────────────────────")
        features = compute_rfm(spark, master)
        write_parquet(features, "customer_features")
        show_summary(features, "customer_features")
        print()

        # ── Step 3b (optional): push features to Supabase ───────────────────
        if args.push_to_db:
            print("Step 3b — pushing customer_features to Supabase")
            print("────────────────────────────────────────────────")
            write_dataframe_to_postgres(
                features,
                table="public.customer_features",
                primary_keys=["customer_unique_id"],
            )
            print()

        elapsed = time.time() - t0
        print(f"✓ Preprocessing complete in {elapsed:0.1f}s")
        return 0

    except FileNotFoundError as e:
        print(f"\n✗ Missing input file:\n  {e}\n")
        return 2

    except Exception as e:  # noqa: BLE001
        import traceback
        print("\n✗ Preprocessing failed:")
        traceback.print_exc()
        return 1

    finally:
        stop_spark()


if __name__ == "__main__":
    sys.exit(main())
