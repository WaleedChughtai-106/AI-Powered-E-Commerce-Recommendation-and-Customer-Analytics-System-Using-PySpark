"""
io_utils — thin wrappers around Spark's read/write APIs.

Why wrap them?
  - Consistent defaults (header=True, inferSchema=False, multiLine for reviews).
  - One place to add logging / row counts for the viva demo.
  - Type-safer call sites: `read_csv(spark, name)` reads from the configured
    RAW_DATA_DIR; callers don't have to know paths.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.types import StructType


# ─── Path helpers ─────────────────────────────────────────────────────────────

def _backend_root() -> Path:
    """
    Resolve the backend/ directory regardless of where the script was launched
    from. Looks two levels up from this file (spark_utils/io_utils.py).
    """
    return Path(__file__).resolve().parent.parent


def raw_data_dir() -> Path:
    """Where the Olist CSVs live. Configurable via RAW_DATA_DIR env var."""
    rel = os.environ.get("RAW_DATA_DIR", "data/raw")
    return (_backend_root() / rel).resolve()


def processed_data_dir() -> Path:
    """Where Spark writes Parquet output. Configurable via PROCESSED_DATA_DIR."""
    rel = os.environ.get("PROCESSED_DATA_DIR", "data/processed")
    out = (_backend_root() / rel).resolve()
    out.mkdir(parents=True, exist_ok=True)
    return out


# ─── CSV reader ───────────────────────────────────────────────────────────────

def read_csv(
    spark: SparkSession,
    filename: str,
    schema: Optional[StructType] = None,
    multi_line: bool = False,
) -> DataFrame:
    """
    Read a CSV from `data/raw/`. We default to inferSchema=False and pass an
    explicit StructType from each cleaner — Olist has known column types and
    inferSchema is both slow and unreliable on the dataset's quoted strings.

    Parameters
    ----------
    filename : str
        e.g. "olist_orders_dataset.csv". Path is resolved against raw_data_dir().
    schema : StructType, optional
        Recommended. Pass `None` only for one-off exploration.
    multi_line : bool
        Set True for `olist_order_reviews_dataset.csv` — review comments
        contain literal newlines inside quoted strings and Spark needs to
        be told to treat them as a single cell.
    """
    path = raw_data_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Missing raw file: {path}\n"
            f"Download the Olist dataset and place CSVs in {raw_data_dir()}."
        )

    reader = (
        spark.read.option("header", True)
        .option("escape", '"')
        .option("multiLine", str(multi_line).lower())
        .option("mode", "PERMISSIVE")
    )
    if schema is not None:
        reader = reader.schema(schema)
    else:
        reader = reader.option("inferSchema", True)

    df = reader.csv(str(path))
    return df


# ─── Parquet writer / reader ──────────────────────────────────────────────────

def write_parquet(df: DataFrame, name: str, mode: str = "overwrite") -> Path:
    """
    Persist a cleaned/feature-engineered DataFrame to `data/processed/<name>/`.
    Parquet is the right intermediate format here: typed, compressed, splittable,
    and pandas/PySpark can both read it.
    """
    out = processed_data_dir() / name
    df.write.mode(mode).parquet(str(out))
    return out


def read_parquet(spark: SparkSession, name: str) -> DataFrame:
    """Read back a Parquet folder previously written by write_parquet()."""
    path = processed_data_dir() / name
    if not path.exists():
        raise FileNotFoundError(
            f"Missing processed dataset: {path}\n"
            f"Run the preprocessing pipeline first (scripts/run_preprocessing.py)."
        )
    return spark.read.parquet(str(path))


# ─── Sanity helpers ───────────────────────────────────────────────────────────

def show_summary(df: DataFrame, name: str) -> None:
    """Print a short summary — handy in the orchestrator and in viva demos."""
    n = df.count()
    print(f"  • {name}: {n:,} rows, {len(df.columns)} cols")
