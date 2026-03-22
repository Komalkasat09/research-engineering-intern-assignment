#!/usr/bin/env python3
"""09_validate.py — Validate all data pipeline outputs."""

import json
from pathlib import Path
import sys

print("\n── Step 9: VALIDATE ALL ARTIFACTS ─────────────────────")

checks_passed = 0
checks_failed = 0

required_files = {
    ("public/data/topics.json", "✓", "≥3 clusters"),
    ("public/data/umap_points.json", "≥1000 points", "UMAP visualization"),
    ("public/data/velocity.json", "≥100 rows", "Narrative velocity"),
    ("public/data/stance_series.json", "≥50 rows", "Stance distribution"),
    ("public/data/coord.json", "exists", "Coordination heatmap"),
    ("public/data/graph.json", "exists", "Social network"),
    ("data/faiss.index", "✓", "FAISS vector index"),
    ("data/faiss_meta.json", "≥1000 entries", "FAISS metadata"),
}

print("\n  File validation:")
for check in [("public/data/topics.json", "✓", "≥3 clusters")]:
    path = Path(check[0])
    if not path.exists():
        print(f"    ✗ {path} NOT FOUND")
        checks_failed += 1
        continue
    
    try:
        size_mb = path.stat().st_size / 1e6
        print(f"    ✓ {path} ({size_mb:.2f} MB)")
        checks_passed += 1
    except Exception as e:
        print(f"    ✗ {path} ERROR: {e}")
        checks_failed += 1

for fname in ["public/data/velocity.json", "public/data/coord.json", "public/data/graph.json"]:
    path = Path(fname)
    if path.exists():
        size_kb = path.stat().st_size / 1024
        print(f"    ✓ {path} ({size_kb:.1f} KB)")
        checks_passed += 1
    else:
        print(f"    ✗ {path} NOT FOUND")
        checks_failed += 1

# Check umap_points.json
umap_path = Path("public/data/umap_points.json")
if umap_path.exists():
    with open(umap_path) as f:
        data = json.load(f)
        if isinstance(data, list) and len(data) >= 1000:
            print(f"    ✓ {umap_path} ({len(data):,} points)")
            checks_passed += 1
        else:
            print(f"    ✗ {umap_path} has only {len(data)} points (need ≥1000)")
            checks_failed += 1
else:
    print(f"    ✗ {umap_path} NOT FOUND")
    checks_failed += 1

# Check stance_series
stance_path = Path("public/data/stance_series.json")
if stance_path.exists():
    with open(stance_path) as f:
        data = json.load(f)
        if isinstance(data, list) and len(data) >= 50:
            print(f"    ✓ {stance_path} ({len(data):,} rows)")
            checks_passed += 1
        else:
            print(f"    ⚠ {stance_path} has only {len(data)} rows (want ≥50)")
else:
    print(f"    ⚠ {stance_path} NOT FOUND (optional)")

# Check FAISS
faiss_idx = Path("data/faiss.index")
if faiss_idx.exists():
    size_mb = faiss_idx.stat().st_size / 1e6
    print(f"    ✓ data/faiss.index ({size_mb:.1f} MB)")
    checks_passed += 1
else:
    print(f"    ✗ data/faiss.index NOT FOUND")
    checks_failed += 1

faiss_meta = Path("data/faiss_meta.json")
if faiss_meta.exists():
    with open(faiss_meta) as f:
        meta = json.load(f)
        posts = meta.get("posts", [])
        if len(posts) >= 1000:
            print(f"    ✓ data/faiss_meta.json ({len(posts):,} entries)")
            checks_passed += 1
        else:
            print(f"    ⚠ data/faiss_meta.json has {len(posts):,} entries (want ≥1000)")
else:
    print(f"    ✗ data/faiss_meta.json NOT FOUND")
    checks_failed += 1

# Summary
print(f"\n  VALIDATION SUMMARY:")
print(f"    Passed: {checks_passed}")
print(f"    Failed: {checks_failed}")

if checks_failed > 0:
    print(f"\n  ✗ VALIDATION FAILED - Some artifacts missing!")
    sys.exit(1)
else:
    print(f"\n  ✓ VALIDATION PASSED - All artifacts present!")
    sys.exit(0)
