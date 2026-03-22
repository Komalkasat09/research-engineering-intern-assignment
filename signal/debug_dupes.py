#!/usr/bin/env python3
import pandas as pd
from pathlib import Path

# Load and normalize
df = pd.read_json("data/raw/dataset.jsonl", lines=True, dtype=False)
df = pd.json_normalize(df["data"])

# Check for duplicates
dupes_before = df.columns[df.columns.duplicated(keep=False)]
print(f"Duplicate columns BEFORE dedup: {len(dupes_before)}")
if len(dupes_before) > 0:
    print(f"  Examples: {list(dupes_before[:10])}")

# Try to count how many COLUMNS are duplicated
import collections
col_counts = collections.Counter(df.columns)
dupes_detail = {col: count for col, count in col_counts.items() if count > 1}
print(f"\nColumns with multiple occurrences: {len(dupes_detail)}")
if dupes_detail:
    for col, count in list(dupes_detail.items())[:10]:
        print(f"  {col}: {count} times")

# Now apply the dedup like the script does
df_dedup = df.loc[:, ~df.columns.duplicated(keep='first')]
print(f"\nAfter dedup: {df_dedup.shape}")

# Check if created_utc is still a problem
print(f"\nColumn access test:")
print(f"  'created_utc' in df_dedup.columns: {'created_utc' in df_dedup.columns}")
val = df_dedup['created_utc']
print(f"  Type of df_dedup['created_utc']: {type(val)}")

# Try to debug this
if isinstance(val, pd.DataFrame):
    print(f"  It's a DataFrame with shape: {val.shape}")
    print(f"  Columns: {list(val.columns)}")
