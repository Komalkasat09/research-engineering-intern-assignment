#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
import collections

# Load and normalize
df = pd.read_json("data/raw/dataset.jsonl", lines=True, dtype=False)
df = pd.json_normalize(df["data"])

print(f"After json_normalize: {df.shape}")

# The issue might be the RENAME creating duplicate columns!
COL_ALIASES = {
    "selftext": "text",
    "ups": "score",
    "created": "created_utc",
    "comments": "num_comments",
    "comment_count": "num_comments",
    "post_id": "post_id",
    "id": "post_id",
}

# Check what will be renamed
renames = {k: v for k, v in COL_ALIASES.items() if k in df.columns}
print(f"\nWill rename {len(renames)} columns:")
for k, v in renames.items():
    print(f"  {k} -> {v}")

# CHECK: if multiple source columns map to the same target, we get dupes!
target_counts = collections.Counter(renames.values())
problem_targets = {t: count for t, count in target_counts.items() if count > 1}
if problem_targets:
    print(f"\n!!! WARNING: Multiple columns mapping to same target:")
    for target, count in problem_targets.items():
        sources = [k for k, v in renames.items() if v == target]
        print(f"  Target '{target}' from sources: {sources}")

# Now do the rename
df_renamed = df.rename(columns=renames)
print(f"\nAfter rename: {df_renamed.shape}")

# Check for dupes AFTER rename
dupes_after = df_renamed.columns[df_renamed.columns.duplicated(keep=False)]
print(f"Duplicate columns AFTER rename: {len(dupes_after)}")
if len(dupes_after) > 0:
    dupe_counts = collections.Counter(dupes_after)
    for col, count in dupe_counts.items():
        print(f"  {col}: {count} times")

# Test access
if len(dupes_after) > 0:
    print(f"\nTesting access to duplicated column '{dupes_after[0]}':")
    val = df_renamed[dupes_after[0]]
    print(f"  Type: {type(val)}")
    if isinstance(val, pd.DataFrame):
        print(f"  It's a DataFrame with {len(val.columns)} columns")
