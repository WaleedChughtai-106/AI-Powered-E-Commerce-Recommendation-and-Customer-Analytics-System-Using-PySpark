"""
sales_forecast — optional scikit-learn daily-revenue forecaster.

This is the only non-Spark model in the pipeline. The dataset's time
dimension is tiny (~700 days of Olist data), so dragging Spark MLlib
into the picture would be ceremony — scikit-learn on a single pandas
DataFrame is the right scale.

Approach
────────
1. Aggregate master_facts to daily revenue (sum of item_revenue over
   non-canceled orders, grouped by purchase_date).
2. Engineer time features: trend (days since start), day-of-week,
   month, lag_1, lag_7, rolling_mean_7. Lag features pull recent
   information into the predictor space and dramatically improve fit
   over a pure trend model.
3. Train RandomForestRegressor (default) or LinearRegression
   (`--model linreg`) on the first N-30 days; evaluate on the held-out
   last 30 days with RMSE and R².
4. Re-fit on the full series, then forecast `--horizon` days into the
   future. Confidence interval is ±1.96 × residual_std on the
   training set (the standard parametric CI; it is an approximation
   under non-normal residuals, but adequate for a viva visualisation).
5. Write predictions to public.sales_forecasts (one row per future
   date) and log RMSE + R² to public.ml_model_runs.

Output schema for sales_forecasts (matches database/schema.sql)
───────────────────────────────────────────────────────────────
  forecast_date     date PK
  predicted_revenue numeric(14,2)
  lower_bound       numeric(14,2)
  upper_bound       numeric(14,2)
  model_name        text       e.g. 'sklearn-randomforest'
  generated_at      timestamptz
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from typing import Literal

import numpy as np
import pandas as pd
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

from spark_utils import read_parquet  # sales_forecasts upserts via psycopg2 directly (custom shape)


# ─── Tunables ─────────────────────────────────────────────────────────────────

DEFAULT_HORIZON       = 30      # days to forecast
DEFAULT_HOLDOUT_DAYS  = 30      # tail-end days reserved for evaluation
DEFAULT_MODEL         = "randomforest"   # 'randomforest' | 'linreg'
DEFAULT_N_ESTIMATORS  = 200
DEFAULT_RANDOM_STATE  = 42


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _aggregate_daily_revenue(master: DataFrame) -> pd.DataFrame:
    """
    Returns a pandas DataFrame with columns: date, revenue (float).
    Sorted by date ascending, gaps filled with 0.
    """
    daily = (
        master
        .filter(~F.col("is_canceled"))
        .filter(F.col("purchase_date").isNotNull())
        .groupBy("purchase_date")
        .agg(F.sum("item_revenue").alias("revenue"))
    )
    pdf = daily.toPandas()
    pdf["purchase_date"] = pd.to_datetime(pdf["purchase_date"])
    pdf = pdf.rename(columns={"purchase_date": "date"})
    pdf["revenue"] = pdf["revenue"].astype(float).fillna(0.0)
    pdf = pdf.sort_values("date").reset_index(drop=True)

    # Fill missing days with 0 so lag features are well-defined.
    full_range = pd.date_range(start=pdf["date"].min(), end=pdf["date"].max(), freq="D")
    pdf = (
        pdf.set_index("date")
           .reindex(full_range, fill_value=0.0)
           .rename_axis("date")
           .reset_index()
    )
    return pdf


def _engineer_features(series: pd.DataFrame) -> pd.DataFrame:
    """
    Add time + lag features. Drops the first 7 rows (where lag_7 is undefined).
    Returns columns: date, revenue, trend, dow, month, lag_1, lag_7, roll_mean_7.
    """
    df = series.copy()
    df["trend"]       = np.arange(len(df))
    df["dow"]         = df["date"].dt.dayofweek
    df["month"]       = df["date"].dt.month
    df["lag_1"]       = df["revenue"].shift(1)
    df["lag_7"]       = df["revenue"].shift(7)
    df["roll_mean_7"] = df["revenue"].rolling(window=7, min_periods=1).mean().shift(1)
    df = df.dropna().reset_index(drop=True)
    return df


def _make_model(model_name: str, n_estimators: int, random_state: int):
    """Instantiate sklearn model."""
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.linear_model import LinearRegression

    if model_name == "randomforest":
        return RandomForestRegressor(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=-1,
        ), "sklearn-randomforest"
    if model_name == "linreg":
        return LinearRegression(), "sklearn-linreg"
    raise ValueError(f"Unknown model: {model_name!r} (expected 'randomforest' or 'linreg')")


def _log_ml_run(model_name: str, metric_name: str, metric_value: float,
                params: dict, push_to_db: bool) -> None:
    """Insert one row into public.ml_model_runs. Best-effort."""
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


def _push_forecasts_to_db(df: pd.DataFrame) -> None:
    """Upsert forecast rows into public.sales_forecasts via psycopg2."""
    if df.empty:
        return
    import psycopg2
    from psycopg2.extras import execute_values
    from spark_utils.db_writer import _get_db_url

    rows = [
        (
            row.forecast_date,
            float(row.predicted_revenue),
            float(row.lower_bound) if not pd.isna(row.lower_bound) else None,
            float(row.upper_bound) if not pd.isna(row.upper_bound) else None,
            row.model_name,
            row.generated_at,
        )
        for row in df.itertuples(index=False)
    ]
    sql = """
        INSERT INTO public.sales_forecasts
            (forecast_date, predicted_revenue, lower_bound, upper_bound, model_name, generated_at)
        VALUES %s
        ON CONFLICT (forecast_date) DO UPDATE
        SET predicted_revenue = EXCLUDED.predicted_revenue,
            lower_bound       = EXCLUDED.lower_bound,
            upper_bound       = EXCLUDED.upper_bound,
            model_name        = EXCLUDED.model_name,
            generated_at      = EXCLUDED.generated_at
    """
    with psycopg2.connect(_get_db_url()) as conn, conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=500)
    print(f"    [db_writer] public.sales_forecasts: {len(rows):,} rows written")


# ─── Main entry point ─────────────────────────────────────────────────────────

def run(
    spark: SparkSession,
    horizon: int = DEFAULT_HORIZON,
    holdout_days: int = DEFAULT_HOLDOUT_DAYS,
    model_name: Literal["randomforest", "linreg"] = DEFAULT_MODEL,
    n_estimators: int = DEFAULT_N_ESTIMATORS,
    random_state: int = DEFAULT_RANDOM_STATE,
    push_to_db: bool = False,
) -> dict:
    """
    Train forecaster, predict the next `horizon` days, persist.
    """
    from sklearn.metrics import mean_squared_error, r2_score

    print(f"  Forecast config — model={model_name}, horizon={horizon}, "
          f"holdout={holdout_days}d")
    master = read_parquet(spark, "master_facts")

    series = _aggregate_daily_revenue(master)
    if len(series) < holdout_days + 14:
        raise RuntimeError(
            f"Daily series too short ({len(series)} days) for holdout="
            f"{holdout_days}. Need at least holdout+14."
        )

    feat = _engineer_features(series)
    train = feat.iloc[:-holdout_days].copy()
    test  = feat.iloc[-holdout_days:].copy()

    feature_cols = ["trend", "dow", "month", "lag_1", "lag_7", "roll_mean_7"]
    estimator, sklearn_model_name = _make_model(model_name, n_estimators, random_state)
    estimator.fit(train[feature_cols], train["revenue"])

    # Evaluate on holdout.
    pred_test = estimator.predict(test[feature_cols])
    rmse = float(math.sqrt(mean_squared_error(test["revenue"], pred_test)))
    r2   = float(r2_score(test["revenue"], pred_test))
    print(f"    rmse        : {rmse:,.2f}")
    print(f"    r2          : {r2:.4f}")

    # Re-fit on the entire history before forecasting forward.
    final_estimator, _ = _make_model(model_name, n_estimators, random_state)
    final_estimator.fit(feat[feature_cols], feat["revenue"])

    # Residual std for the confidence band, computed on the full-fit training set.
    residuals = feat["revenue"].values - final_estimator.predict(feat[feature_cols])
    residual_std = float(np.std(residuals))

    # Iterative forecast: each future day's lag_1 is yesterday's prediction.
    history = list(feat["revenue"].values)
    last_date = pd.to_datetime(feat["date"].iloc[-1])
    trend_offset = int(feat["trend"].iloc[-1])

    forecast_rows = []
    generated_at = datetime.now(timezone.utc)
    for step in range(1, horizon + 1):
        d = (last_date + timedelta(days=step)).date()
        lag_1 = float(history[-1])
        lag_7 = float(history[-7]) if len(history) >= 7 else lag_1
        roll7 = float(np.mean(history[-7:])) if len(history) >= 7 else lag_1

        row = pd.DataFrame([{
            "trend": trend_offset + step,
            "dow":   pd.Timestamp(d).dayofweek,
            "month": pd.Timestamp(d).month,
            "lag_1": lag_1,
            "lag_7": lag_7,
            "roll_mean_7": roll7,
        }])
        pred = float(final_estimator.predict(row[feature_cols])[0])
        history.append(pred)

        lower = max(0.0, pred - 1.96 * residual_std)
        upper = pred + 1.96 * residual_std

        forecast_rows.append({
            "forecast_date":     d,
            "predicted_revenue": round(pred, 2),
            "lower_bound":       round(lower, 2),
            "upper_bound":       round(upper, 2),
            "model_name":        sklearn_model_name,
            "generated_at":      generated_at,
        })

    forecast_df = pd.DataFrame(forecast_rows)
    print(f"    forecasted  : {len(forecast_df):,} future days "
          f"({forecast_df['forecast_date'].min()} → {forecast_df['forecast_date'].max()})")

    # Persist.
    if push_to_db:
        _push_forecasts_to_db(forecast_df)

    # Also write to Parquet for parity with the other ml_models.
    forecast_out_path = (
        # Defer the import to avoid circular dependency in narrow CI environments.
        __import__("spark_utils.io_utils", fromlist=["processed_data_dir"]).processed_data_dir()
        / "sales_forecasts"
    )
    forecast_out_path.mkdir(parents=True, exist_ok=True)
    forecast_df.to_parquet(forecast_out_path / "forecast.parquet", index=False)

    params = {
        "model": sklearn_model_name,
        "horizon": horizon,
        "holdout_days": holdout_days,
        "n_estimators": n_estimators if model_name == "randomforest" else None,
        "feature_cols": feature_cols,
        "residual_std": residual_std,
        "series_days": int(len(feat)),
    }
    _log_ml_run("sales_forecast", "rmse", rmse, params, push_to_db)
    _log_ml_run("sales_forecast", "r2",   r2,   params, push_to_db)

    return {
        "rmse": rmse,
        "r2": r2,
        "horizon_days": horizon,
        "model": sklearn_model_name,
        "n_rows": int(len(forecast_df)),
    }
