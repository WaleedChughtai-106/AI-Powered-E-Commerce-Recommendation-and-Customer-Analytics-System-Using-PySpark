"""
spark_utils — small package for SparkSession bootstrap, file I/O, and DB writes.

Naming note
───────────
Phase 1 originally called this folder `pyspark/`, but that name collides with
the actual `pyspark` library on the import path. `from pyspark.sql import ...`
would resolve to *this* local folder instead of the installed library, breaking
every script. The folder was renamed to `spark_utils/` to fix the collision.
"""

from .spark_session import get_spark
from .io_utils import read_csv, write_parquet, read_parquet
from .db_writer import write_dataframe_to_postgres

__all__ = [
    "get_spark",
    "read_csv",
    "write_parquet",
    "read_parquet",
    "write_dataframe_to_postgres",
]
