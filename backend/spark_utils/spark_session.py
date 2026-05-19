"""
spark_session — single reusable SparkSession builder.

Why a module-level builder?
  - Tuning lives in one place. Memory, shuffle partitions, JDBC driver
    classpath, timezone — change once and every script picks it up.
  - Repeated calls return the *same* live session via getOrCreate(), which is
    important when notebooks or orchestrators call multiple scripts in a row.

Usage:
    from spark_utils import get_spark
    spark = get_spark("preprocess")
    df = spark.read.csv(...)
"""

from __future__ import annotations

import os
from typing import Optional

from pyspark.sql import SparkSession


def get_spark(app_name: str = "QuantumaAI", extra_jars: Optional[str] = None) -> SparkSession:
    """
    Build (or fetch) the global SparkSession.

    Parameters
    ----------
    app_name : str
        Shown in the Spark UI (default port 4040). Pick something descriptive
        per script so it's easy to spot the running job.
    extra_jars : str, optional
        Comma-separated absolute paths to JAR files to add to the classpath.
        Use this to pass the PostgreSQL JDBC driver when writing via JDBC:
            get_spark("seed", extra_jars="/path/to/postgresql-42.7.3.jar")

    Notes on the config below
    -------------------------
    - `spark.sql.session.timeZone=UTC` makes Olist timestamps comparable
      regardless of the host machine. Without this, the recency calculation
      drifts by ±1 day depending on whether you run from São Paulo or
      Karachi.
    - `spark.sql.shuffle.partitions=8` is fine for laptop / 100k-row Olist.
      The default 200 over-shards everything and slows things down.
    - `spark.sql.execution.arrow.pyspark.enabled=true` switches DataFrame ↔
      pandas conversions to Apache Arrow, which is ~10x faster than the
      default pickle path. Needed by `df.toPandas()` and the feature
      engineering step.
    """
    driver_memory = os.environ.get("SPARK_DRIVER_MEMORY", "2g")
    shuffle_parts = os.environ.get("SPARK_SHUFFLE_PARTITIONS", "8")

    builder = (
        SparkSession.builder.appName(app_name)
        .config("spark.driver.memory", driver_memory)
        .config("spark.sql.shuffle.partitions", shuffle_parts)
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.execution.arrow.pyspark.enabled", "true")
        .config("spark.sql.adaptive.enabled", "true")
        # Suppress noisy log4j WARNs on session startup. Real errors still surface.
        .config("spark.ui.showConsoleProgress", "false")
    )

    if extra_jars:
        builder = builder.config("spark.jars", extra_jars)

    spark = builder.getOrCreate()
    # Quieten the default INFO chatter — only WARN and above.
    spark.sparkContext.setLogLevel("WARN")
    return spark


def stop_spark() -> None:
    """Tear down the active SparkSession (use in `finally` blocks or notebooks)."""
    active = SparkSession.getActiveSession()
    if active is not None:
        active.stop()
