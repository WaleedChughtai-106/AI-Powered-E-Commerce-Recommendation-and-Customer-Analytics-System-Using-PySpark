"""
seed_supabase.py — single-command end-to-end seeder.

Runs the Phase 6 preprocessing pipeline AND the Phase 7 ML + analytics
pipeline, then pushes every output table to Supabase. After this script
finishes cleanly, the dashboard's mock data can be swapped out (Phase 8)
and every chart will have real data behind it.

Run from backend/:
    python -m scripts.seed_supabase
    python -m scripts.seed_supabase --skip-preprocessing   # if Parquet already on disk
    python -m scripts.seed_supabase --skip-forecast        # skip the optional sklearn step

The flag forwarding is intentionally narrow: this script is a *seeder*,
not a development harness. If you want fine-grained control, call
`run_preprocessing` and `run_ml_pipeline` directly.

Exit codes
──────────
  0  everything succeeded
  1  preprocessing failed (ML pipeline NOT attempted)
  2  ML pipeline failed (preprocessing already succeeded — re-run with
                          --skip-preprocessing to retry just the ML half)
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from dotenv import load_dotenv


_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

load_dotenv(_BACKEND_ROOT / ".env")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="One-shot Supabase seeder (Phase 6 + Phase 7).")
    p.add_argument("--skip-preprocessing", action="store_true",
                   help="Skip Phase 6. Use when the Parquet outputs are already on disk.")
    p.add_argument("--skip-forecast", action="store_true",
                   help="Skip the optional sklearn sales forecaster.")
    return p.parse_args()


def _run_step(description: str, argv: list[str]) -> int:
    """
    Run a sibling -m script in-process by mutating sys.argv and calling its
    main(). Keeps the SparkSession reuse semantics intact (each script's
    own try/finally stops its session).
    """
    print()
    print("┌─────────────────────────────────────────────────────────────────┐")
    print(f"│ {description:<63} │")
    print("└─────────────────────────────────────────────────────────────────┘")
    saved_argv = sys.argv[:]
    sys.argv = argv
    try:
        if argv[0].endswith("run_preprocessing"):
            from scripts.run_preprocessing import main as preprocess_main
            return preprocess_main()
        if argv[0].endswith("run_ml_pipeline"):
            from scripts.run_ml_pipeline import main as ml_main
            return ml_main()
        raise ValueError(f"Unknown step: {argv[0]}")
    finally:
        sys.argv = saved_argv


def main() -> int:
    args = parse_args()
    t0 = time.time()

    print("═════════════════════════════════════════════════════════════════")
    print("  Quantuma AI — Supabase seeder (Phase 6 → Phase 7 → DB)")
    print("═════════════════════════════════════════════════════════════════")
    print(f"  skip-preprocessing: {args.skip_preprocessing}")
    print(f"  skip-forecast     : {args.skip_forecast}")

    if not args.skip_preprocessing:
        rc = _run_step(
            "Step A — Phase 6 preprocessing  (clean → join → RFM)",
            ["scripts.run_preprocessing", "--push-to-db"],
        )
        if rc != 0:
            print(f"\n✗ Phase 6 failed with exit code {rc}. Aborting before Phase 7.")
            return 1

    ml_argv = ["scripts.run_ml_pipeline", "--push-to-db"]
    if args.skip_forecast:
        ml_argv.append("--skip-forecast")

    rc = _run_step(
        "Step B — Phase 7 ML + analytics  (K-Means, ALS, KPIs, forecast)",
        ml_argv,
    )
    if rc != 0:
        print(f"\n✗ Phase 7 failed with exit code {rc}. "
              f"Re-run with --skip-preprocessing to retry just the ML half.")
        return 2

    elapsed = time.time() - t0
    print()
    print("═════════════════════════════════════════════════════════════════")
    print(f"✓ Supabase seeded in {elapsed:0.1f}s — dashboard is live-data-ready.")
    print("═════════════════════════════════════════════════════════════════")
    return 0


if __name__ == "__main__":
    sys.exit(main())
