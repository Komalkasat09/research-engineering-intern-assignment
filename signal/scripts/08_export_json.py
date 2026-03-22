"""
08_export_json.py — Convert parquet exports to JSON for frontend routes.

Usage:
  python scripts/08_export_json.py
  python scripts/08_export_json.py --max-points 60000
"""

import argparse
import json
from pathlib import Path

import pandas as pd


def export_umap_points(max_points: int = 60000) -> int:
    print("  Converting data/umap_2d.parquet to public/data/umap_points.json...")

    df = pd.read_parquet("data/umap_2d.parquet")

    if len(df) > max_points:
        step = max(1, len(df) // max_points)
        df = df.iloc[::step].reset_index(drop=True)

    records = df[["post_id", "umap_x", "umap_y", "topic_id", "score"]].to_dict("records")

    out = Path("public/data/umap_points.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w") as f:
        json.dump(records, f)

    print(f"    Wrote {out} ({len(records):,} rows)")
    return len(records)


def verify_json(filepath: str) -> None:
    p = Path(filepath)
    if p.exists():
        print(f"    ✓ {filepath}")
    else:
        print(f"    ✗ {filepath} missing")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-points", type=int, default=60000)
    args = parser.parse_args()

    print("\n── Step 8: Export JSON ──────────────────────────────────────")
    export_umap_points(args.max_points)

    print("\n  Verifying required frontend exports:")
    verify_json("public/data/topics.json")
    verify_json("public/data/velocity.json")
    verify_json("public/data/stance_series.json")
    verify_json("public/data/coord.json")
    verify_json("public/data/graph.json")

    print("\nDone. Run scripts/09_validate.py next.\n")


if __name__ == "__main__":
    main()
