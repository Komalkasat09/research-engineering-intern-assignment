#!/usr/bin/env python3
"""Quick test of 01_load.py"""
import pandas as pd
from pathlib import Path
import sys

# Step 1: Load raw CSV/JSON/JSONL
def load_raw(path: Path) -> pd.DataFrame:
    """Load CSV or JSON into a DataFrame."""
    suffix = path.suffix.lower()
    print(f"  Loading {path.name} ({path.stat().st_size / 1e6:.1f} MB)...")

    if suffix in (".json", ".jsonl", ".ndjson"):
        try:
            df = pd.read_json(path, dtype=str)
        except ValueError:
            df = pd.read_json(path, lines=True, dtype=False)

        # Reddit exports can be wrapped as {"kind": "t3", "data": {...}}.
        if "data" in df.columns and df["data"].map(lambda v: isinstance(v, dict)).all():
            df = pd.json_normalize(df["data"])
    
    print(f"  Raw shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    return df

# Step 2: Try normalize
def normalise_columns_test(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns to canonical schema."""
    COL_ALIASES = {
        "selftext": "text",
        "ups": "score",
        "created": "created_utc",
        "comments": "num_comments",
        "comment_count": "num_comments",
        "post_id": "post_id",
        "id": "post_id",
    }
    
    # Remove duplicates
    df = df.loc[:, ~df.columns.duplicated(keep='first')]
    print(f"  After dedup: {df.shape[1]} cols")
    
    # Rename
    df = df.rename(columns={k: v for k, v in COL_ALIASES.items() if k in df.columns})
    print(f"  After rename: 'text' in cols = {'text' in df.columns}")
    
    # Create post_id if missing
    if "post_id" not in df.columns:
        df["post_id"] = [f"post_{i}" for i in range(len(df))]
        print(f"  Created post_id column")
    
    return df

# Main
if __name__ == "__main__":
    path = Path("data/raw/dataset.jsonl")
    
    print("\n── Step 1: Load ──────────────────────────────────────────────")
    df = load_raw(path)
    
    print(f"\n── Step 2: Normalise columns ─────────────────────────────────")
    df = normalise_columns_test(df)
    
    print(f"\n── Step 3: Test coerce_types ─────────────────────────────────")
    print("  Accessing df['score']...", end="", flush=True)
    try:
        _ = df["score"]
        print(" OK")
    except Exception as e:
        print(f" ERROR: {e}")
        sys.exit(1)
    
    print("  Accessing df['created_utc']...", end="", flush=True)
    try:
        col = df["created_utc"]
        print(f" OK (type: {type(col).__name__})")
    except Exception as e:
        print(f" ERROR: {e}")
        sys.exit(1)
    
    print("\n✓ All tests passed!")
