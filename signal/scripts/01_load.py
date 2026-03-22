"""
01_load.py — Ingest SimPPL CSV/JSON dataset into DuckDB.

Usage:
    python scripts/01_load.py --input data/raw/dataset.csv
    python scripts/01_load.py --input data/raw/dataset.json

The raw SimPPL dataset may arrive as CSV or JSON with varying column names.
This script normalises everything into a single DuckDB table `posts` and
exports a clean Parquet file for downstream scripts to use.

Expected input columns (flexible — remapped if needed):
    id / post_id, body / text / selftext, author / username,
    subreddit, score / upvotes, created_utc / timestamp,
    url, num_comments / comments
"""

import argparse
import json
import os
import sys
from pathlib import Path

import duckdb
import pandas as pd
from tqdm import tqdm


# ── Column name aliases ──────────────────────────────────────────────────────
# Maps various column names found in the wild → our canonical schema
COL_ALIASES: dict[str, str] = {
    "id":           "post_id",
    "body":         "text",
    "selftext":     "text",
    "content":      "text",
    "username":     "author",
    "user":         "author",
    "upvotes":      "score",
    "timestamp":    "created_utc",
    "created":      "created_utc",
    "comments":     "num_comments",
    "comment_count":"num_comments",
    "link_url":     "url",
    "permalink":    "url",
}

REQUIRED_COLS = {"post_id", "text", "author", "subreddit", "score", "created_utc"}


def load_raw(path: Path) -> pd.DataFrame:
    """Load CSV or JSON into a DataFrame."""
    suffix = path.suffix.lower()
    print(f"  Loading {path.name} ({path.stat().st_size / 1e6:.1f} MB)...")

    if suffix == ".csv":
        df = pd.read_csv(path, dtype=str, low_memory=False)
    elif suffix in (".json", ".jsonl", ".ndjson"):
        # Handle both JSON array and newline-delimited JSON
        try:
            df = pd.read_json(path, dtype=str)
        except ValueError:
            df = pd.read_json(path, lines=True, dtype=False)

        # Reddit exports can be wrapped as {"kind": "t3", "data": {...}}.
        # Flatten that nested payload into top-level tabular columns.
        if "data" in df.columns and df["data"].map(lambda v: isinstance(v, dict)).all():
            df = pd.json_normalize(df["data"])
    elif suffix == ".parquet":
        df = pd.read_parquet(path)
        df = df.astype(str)
    else:
        raise ValueError(f"Unsupported file format: {suffix}")

    print(f"  Raw shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    return df


def normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns to canonical schema, drop unknowns."""
    # Build the rename map first
    rename_map = {k: v for k, v in COL_ALIASES.items() if k in df.columns}
    
    # If renaming would create duplicates (target col already exists), 
    # drop the source col first and keep the existing target
    for src, tgt in list(rename_map.items()):
        if tgt in df.columns and tgt != src:
            # Target already exists, so just drop the source
            df = df.drop(columns=[src], errors='ignore')
            del rename_map[src]
    
    # Now apply the rename
    df = df.rename(columns=rename_map)

    # Some sources have link posts with empty selftext and meaningful titles.
    # Prefer body text when available, otherwise fall back to title.
    if "text" not in df.columns and "title" in df.columns:
        df["text"] = df["title"]
    elif "text" in df.columns and "title" in df.columns:
        txt = df["text"].fillna("").astype(str).str.strip()
        ttl = df["title"].fillna("").astype(str).str.strip()
        df["text"] = txt.where(txt != "", ttl)

    # If no post_id, create one from row index
    if "post_id" not in df.columns:
        df["post_id"] = [f"post_{i}" for i in range(len(df))]

    # Fill missing optional columns with sensible defaults
    defaults = {
        "subreddit":    "unknown",
        "score":        "0",
        "num_comments": "0",
        "url":          "",
    }
    for col, default in defaults.items():
        if col not in df.columns:
            df[col] = default

    # Ensure required columns exist
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns after normalisation: {missing}")

    return df


def coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Cast columns to correct types, drop malformed rows."""
    df = df.copy()

    # Numeric casts
    df["score"]        = pd.to_numeric(df["score"],        errors="coerce").fillna(0).astype(int)
    df["num_comments"] = pd.to_numeric(df["num_comments"], errors="coerce").fillna(0).astype(int)

    # created_utc: accept both unix timestamps and ISO strings
    # Handle case where created_utc might be a DataFrame (duplicate columns)
    created_col = df["created_utc"]
    if isinstance(created_col, pd.DataFrame):
        created_col = created_col.iloc[:, 0]
    
    if created_col.dtype == object:
        # Try parsing as ISO datetime first
        parsed = pd.to_datetime(created_col, errors="coerce", utc=True)
        if parsed.notna().sum() > len(df) * 0.5:
            df["created_utc"] = parsed.astype("int64") // 10**9
        else:
            # Fall back to numeric (unix)
            df["created_utc"] = pd.to_numeric(created_col, errors="coerce").fillna(0).astype(int)

    # Drop rows with empty text or null author
    before = len(df)
    df = df[df["text"].notna() & (df["text"].str.strip() != "") & (df["text"] != "[deleted]") & (df["text"] != "[removed]")]
    df = df[df["author"].notna() & (df["author"] != "[deleted]")]
    print(f"  Dropped {before - len(df):,} empty/deleted rows. Remaining: {len(df):,}")

    # Deduplicate on post_id
    before = len(df)
    df = df.drop_duplicates(subset="post_id")
    print(f"  Dropped {before - len(df):,} duplicate post_ids. Remaining: {len(df):,}")

    return df


def clean_text(df: pd.DataFrame) -> pd.DataFrame:
    """Minimal text cleaning — we want to preserve signal, not over-clean."""
    import re

    df = df.copy()

    # Remove URLs embedded in text (they add noise to embeddings)
    url_re = re.compile(r"https?://\S+|www\.\S+")
    df["text"] = df["text"].str.replace(url_re, " ", regex=True)

    # Collapse whitespace
    df["text"] = df["text"].str.replace(r"\s+", " ", regex=True).str.strip()

    # Truncate very long posts at 512 tokens (rough: 4 chars ≈ 1 token)
    df["text"] = df["text"].str[:2048]

    return df


def write_outputs(df: pd.DataFrame, out_dir: Path) -> None:
    """Write cleaned data to DuckDB + Parquet."""
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Keep only required + useful columns for downstream scripts
    KEEP_COLS = {"post_id", "text", "author", "subreddit", "score", "created_utc", "url", "num_comments"}
    cols_to_keep = [c for c in KEEP_COLS if c in df.columns]
    df_clean = df[cols_to_keep].copy()

    # Parquet for Python scripts
    parquet_path = out_dir / "posts_clean.parquet"
    df_clean.to_parquet(parquet_path, index=False, compression="zstd")
    print(f"  Wrote {parquet_path} ({parquet_path.stat().st_size / 1e6:.1f} MB)")

    # DuckDB for fast analytical queries from Next.js API
    db_path = out_dir / "signal.duckdb"
    con = duckdb.connect(str(db_path))

    con.execute("DROP TABLE IF EXISTS posts")
    con.execute("""
        CREATE TABLE posts AS
        SELECT
            post_id,
            text,
            author,
            subreddit,
            score,
            created_utc,
            url,
            num_comments,
            -- Derived columns used frequently
            DATE_TRUNC('week', TO_TIMESTAMP(created_utc)) AS week_start,
            strftime(TO_TIMESTAMP(created_utc), '%Y-W%W')  AS iso_week,
            EXTRACT('year' FROM TO_TIMESTAMP(created_utc)) AS year
        FROM df_clean
    """)

    # Create indexes for common query patterns
    con.execute("CREATE INDEX IF NOT EXISTS idx_posts_week    ON posts(week_start)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts(author)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit)")

    row_count = con.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    con.close()
    print(f"  Wrote {db_path} · {row_count:,} rows indexed")

    # Summary stats
    print("\n── Dataset summary ──")
    print(f"  Total posts:      {len(df):,}")
    print(f"  Date range:       {pd.to_datetime(df['created_utc'].min(), unit='s').date()} → "
          f"{pd.to_datetime(df['created_utc'].max(), unit='s').date()}")
    print(f"  Unique authors:   {df['author'].nunique():,}")
    print(f"  Unique subreddits:{df['subreddit'].nunique():,}")
    print(f"  Median score:     {df['score'].median():.0f}")


def main():
    parser = argparse.ArgumentParser(description="Load SimPPL dataset into DuckDB")
    parser.add_argument("--input",  required=True, help="Path to raw CSV/JSON/Parquet")
    parser.add_argument("--outdir", default="data",   help="Output directory (default: data/)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.outdir)

    print(f"\n── Step 1: Load ──────────────────────────────────────────────")
    df = load_raw(input_path)

    print(f"\n── Normalising columns ───────────────────────────────────────")
    df = normalise_columns(df)

    print(f"\n── Coercing types ────────────────────────────────────────────")
    df = coerce_types(df)

    print(f"\n── Cleaning text ─────────────────────────────────────────────")
    df = clean_text(df)

    print(f"\n── Writing outputs ───────────────────────────────────────────")
    write_outputs(df, out_dir)

    print(f"\nDone. Run scripts/02_embed.py next.\n")


if __name__ == "__main__":
    main()