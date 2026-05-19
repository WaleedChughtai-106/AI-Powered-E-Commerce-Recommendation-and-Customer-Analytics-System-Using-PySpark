"""
preprocessing — per-table cleaners + master join + feature engineering.

Each clean_* module exposes a single `clean()` function with the same
signature so the orchestrator can call them uniformly:

    clean(spark) -> DataFrame

The output schema of each cleaner matches the corresponding Supabase table
defined in database/schema.sql, so the db_writer can push them straight
through without renames.
"""
