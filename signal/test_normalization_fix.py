#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
import collections

# Load and normalize
df = pd.read_json("data/raw/dataset.jsonl", lines=True, dtype=False)
df = pd.json_normalize(df["data"])

print(f"After json_normalize: {df.shape}")

# Apply the new normalization logic
COL_ALIASES = {
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

# Build the rename map first
rename_map = {k: v for k, v in COL_ALIASES.items() if k in df.columns}
print(f"\nWill rename: {list(rename_map.keys())}")

# If renaming would create duplicates (target col already exists), 
# drop the source col first and keep the existing target
for src, tgt in list(rename_map.items()):
    if tgt in df.columns and tgt != src:
        print(f"  Dropping {src} (target {tgt} already exists)")
        df = df.drop(columns=[src], errors='ignore')
        del rename_map[src]

# Now apply the rename
df = df.rename(columns=rename_map)

print(f"\nAfter normalization: {df.shape}")

# Check for dupes
dupes = df.columns[df.columns.duplicated()]
print(f"Duplicate columns: {len(dupes)}")

# Test access
print(f"\nTest column accesses:")
for col in ["score", "created_utc", "text"]:
    if col in df.columns:
        val = df[col]
        print(f"  df['{col}']: {type(val).__name__} with dtype {getattr(val, 'dtype', 'N/A')}")
