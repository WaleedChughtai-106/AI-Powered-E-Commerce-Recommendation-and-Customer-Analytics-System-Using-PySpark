"""
ml_models — Spark MLlib + scikit-learn models that consume the Parquet output
of the Phase 6 preprocessing pipeline and write results back to Supabase.

Each module exposes a single entry-point function:

    kmeans_segmentation.run(spark)  -> dict   # silhouette, cluster_sizes, ...
    als_recommender.run(spark)      -> dict   # rmse, precision_at_k, k, ...
    sales_forecast.run(spark)       -> dict   # rmse, r2, horizon_days, ...

The orchestrator in scripts/run_ml_pipeline.py calls these in order and
optionally pushes their outputs to Postgres.
"""
