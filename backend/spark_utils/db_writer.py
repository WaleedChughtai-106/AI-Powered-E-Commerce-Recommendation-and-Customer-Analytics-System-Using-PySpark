"""
db_writer — push Spark DataFrames into Supabase / Postgres.

Two strategies are supported. Pick based on dataset size and how much
infra you want to wrangle:

  1. PSYCOPG2 (default, no extra setup):
     Materialise the DataFrame to pandas, then bulk-INSERT via execute_values.
     - Pros: zero JDBC driver hassle, works on Windows out-of-the-box.
     - Cons: pulls the whole DF into driver memory. Fine up to ~5M rows;
       past that, switch to JDBC.

  2. JDBC (Spark-native, distributed write):
     `df.write.jdbc(...)`. Each Spark partition opens a connection and pushes
     rows in parallel. Faster on large datasets but requires the PostgreSQL
     JDBC driver JAR (see PHASE_6_PYSPARK.md for download steps).

Both helpers honour the same UPSERT contract: rows that conflict on the
primary key are updated, not duplicated. The Olist raw tables tolerate
re-running the pipeline because of this.

Authentication
──────────────
SUPABASE_DB_URL must be set in backend/.env. It's the direct Postgres URI you
get from Supabase → Project Settings → Database → Connection string (URI).
Format: postgresql://postgres:<PWD>@db.<ref>.supabase.co:5432/postgres
"""

from __future__ import annotations

import os
from typing import Iterable, Optional

from pyspark.sql import DataFrame


# ─── psycopg2 path (default) ──────────────────────────────────────────────────

def _get_db_url() -> str:
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError(
            "SUPABASE_DB_URL is not set. Copy backend/.env.example to "
            "backend/.env and fill in the Postgres connection string from "
            "Supabase → Project Settings → Database."
        )
    return url


def write_dataframe_to_postgres(
    df: DataFrame,
    table: str,
    primary_keys: Iterable[str],
    update_cols: Optional[Iterable[str]] = None,
    chunk_size: int = 5000,
) -> int:
    """
    UPSERT a Spark DataFrame into a Postgres table via psycopg2.

    Parameters
    ----------
    df : DataFrame
        The Spark DataFrame to write. Will be `.toPandas()`-d, so keep it
        reasonably sized.
    table : str
        Fully-qualified table name, e.g. "public.customers".
    primary_keys : iterable of str
        Column(s) used in ON CONFLICT. Must match the table's PK in Postgres.
    update_cols : iterable of str, optional
        Columns to DO UPDATE SET on conflict. If None, defaults to "every
        column that's not in primary_keys".
    chunk_size : int
        Rows per batch for execute_values. 5000 is a sane default.

    Returns
    -------
    int : total rows attempted (pre-conflict).
    """
    # Lazy import so the rest of the package works without psycopg2 installed
    # (useful in CI / lint passes).
    import pandas as pd
    import psycopg2
    from psycopg2.extras import execute_values

    pdf = df.toPandas()
    if pdf.empty:
        print(f"    [db_writer] {table}: 0 rows, skipping")
        return 0

    cols = list(pdf.columns)
    pk_list = list(primary_keys)
    update_list = list(update_cols) if update_cols else [c for c in cols if c not in pk_list]

    col_sql       = ", ".join(f'"{c}"' for c in cols)
    pk_sql        = ", ".join(f'"{c}"' for c in pk_list)
    update_sql    = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_list)
    on_conflict   = f"ON CONFLICT ({pk_sql}) DO UPDATE SET {update_sql}" if update_list else \
                    f"ON CONFLICT ({pk_sql}) DO NOTHING"

    insert_stmt = f"""
        INSERT INTO {table} ({col_sql}) VALUES %s
        {on_conflict};
    """.strip()

    # Pandas → list of tuples in column order. Every flavour of missing
    # value (NaN floats, NaT timestamps, None, pd.NA) becomes Python None
    # so psycopg2 maps it to SQL NULL. The earlier `isinstance(v, float)
    # and v != v` check only caught NaN — NaT slipped through and arrived
    # at Postgres as the literal string "NaT".
    def _null_or(v):
        try:
            if pd.isna(v):
                return None
        except (TypeError, ValueError):
            # pd.isna can raise on exotic types; fall through and let
            # psycopg2 decide.
            pass
        return v

    rows = [
        tuple(_null_or(v) for v in row)
        for row in pdf.itertuples(index=False, name=None)
    ]

    conn = psycopg2.connect(_get_db_url())
    try:
        with conn, conn.cursor() as cur:
            execute_values(cur, insert_stmt, rows, page_size=chunk_size)
        print(f"    [db_writer] {table}: {len(rows):,} rows written")
        return len(rows)
    finally:
        conn.close()


# ─── JDBC path (optional, distributed write) ──────────────────────────────────

def write_dataframe_via_jdbc(
    df: DataFrame,
    table: str,
    mode: str = "append",
    batch_size: int = 5000,
) -> None:
    """
    Spark-native distributed write. Requires the PostgreSQL JDBC driver JAR
    on the Spark classpath — see PHASE_6_PYSPARK.md.

    Note: `df.write.jdbc(mode="append")` does NOT do upserts; it'll fail on
    PK conflicts. Use this for truncate-then-load patterns (e.g. fact tables
    you rebuild every run), or stage to a temp table and MERGE separately.
    """
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("SUPABASE_DB_URL is not set (see backend/.env.example).")

    # Spark JDBC wants jdbc:postgresql://..., not postgresql://...
    jdbc_url = url.replace("postgresql://", "jdbc:postgresql://", 1)

    (
        df.write.format("jdbc")
        .option("url", jdbc_url)
        .option("dbtable", table)
        .option("driver", "org.postgresql.Driver")
        .option("batchsize", batch_size)
        .mode(mode)
        .save()
    )
