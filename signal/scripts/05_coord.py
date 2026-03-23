"""
05_coord.py — Coordinated behavior detection.

Definition: Two accounts are "potentially coordinated" if they share the
same URL AND post within WINDOW_MINUTES of each other, more than
MIN_SYNC_EVENTS times across the dataset.

This is a conservative, falsifiable definition — it flags accounts whose
behavior is statistically unlikely to be coincidental. It does NOT claim
malicious intent; it surfaces patterns for human review.

Known false positive sources:
  - Moderators cross-posting to sister subreddits
  - Bots responding to the same news event
  - Friends sharing the same link simultaneously

Output:
    data/coord_pairs.parquet       — flagged account pairs + metadata
    public/data/coord.json         — D3-ready heatmap data

Usage:
    python scripts/05_coord.py
    python scripts/05_coord.py --window 20 --min-syncs 5
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd
import numpy as np
from tqdm import tqdm


WINDOW_MINUTES  = 30
MIN_SYNC_EVENTS = 3


def find_coord_pairs(
    df: pd.DataFrame,
    window_min: int,
    min_syncs: int,
) -> list[dict]:
    """
    For each URL shared by ≥2 accounts, find all pairs that posted
    within window_min of each other.
    """
    window_sec = window_min * 60

    # Only consider posts with a non-empty URL
    url_df = df[df["url"].notna() & (df["url"].str.strip() != "")].copy()
    url_df = url_df.sort_values("created_utc")

    print(f"  Posts with URLs: {len(url_df):,}")

    # Group by URL → for each URL, find close-time pairs
    # We use a sorted sweep rather than O(n²) comparison
    pair_syncs: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for url, grp in tqdm(url_df.groupby("url"), desc="Scanning URLs"):
        posts = grp[["author", "created_utc", "post_id"]].sort_values("created_utc")
        rows  = posts.to_dict("records")

        # Sliding window: for each post, find all later posts within window
        for i, p_i in enumerate(rows):
            for j in range(i + 1, len(rows)):
                p_j = rows[j]
                gap = p_j["created_utc"] - p_i["created_utc"]

                if gap > window_sec:
                    break  # sorted, so no further matches

                if p_i["author"] == p_j["author"]:
                    continue  # same account posting twice

                # Canonical pair key: alphabetically sorted
                a, b = sorted([p_i["author"], p_j["author"]])
                pair_syncs[(a, b)].append({
                    "url":     url,
                    "gap_sec": int(gap),
                    "post_a":  p_i["post_id"],
                    "post_b":  p_j["post_id"],
                    "ts":      int(p_i["created_utc"]),
                })

    print(f"  Candidate pairs: {len(pair_syncs):,}")

    # Filter to pairs with enough sync events
    flagged = []
    for (a, b), events in pair_syncs.items():
        if len(events) < min_syncs:
            continue

        shared_urls = list({e["url"] for e in events})
        avg_gap     = np.mean([e["gap_sec"] for e in events]) / 60  # → minutes

        flagged.append({
            "account_a":    a,
            "account_b":    b,
            "sync_count":   len(events),
            "avg_gap_min":  round(float(avg_gap), 1),
            "shared_urls":  shared_urls[:10],  # cap for JSON size
            "first_sync_ts": min(e["ts"] for e in events),
            "last_sync_ts":  max(e["ts"] for e in events),
        })

    flagged.sort(key=lambda x: x["sync_count"], reverse=True)
    print(f"  Flagged pairs (≥{min_syncs} syncs): {len(flagged):,}")
    return flagged


def build_heatmap_data(pairs: list[dict], df: pd.DataFrame) -> dict:
    """
    Build D3-ready data for the coordination heatmap.
    Rows = top accounts by sync involvement.
    Columns = month buckets.
    Cell value = number of sync events in that month.
    """
    # Get top 40 accounts by total sync involvement
    account_counts: dict[str, int] = defaultdict(int)
    for p in pairs:
        account_counts[p["account_a"]] += p["sync_count"]
        account_counts[p["account_b"]] += p["sync_count"]

    top_accounts = sorted(account_counts, key=account_counts.get, reverse=True)[:40]

    # Build month series from actual post date range.
    posts = df.copy()
    posts["date"] = pd.to_datetime(
        posts["created_utc"].astype(float), unit="s", errors="coerce"
    )
    valid_dates = posts["date"].dropna()
    if valid_dates.empty:
        months = []
    else:
        min_month = valid_dates.dt.to_period("M").min().strftime("%Y-%m")
        max_month = valid_dates.dt.to_period("M").max().strftime("%Y-%m")
        months = []
        current = pd.Period(min_month, "M")
        end = pd.Period(max_month, "M")
        while current <= end:
            months.append(str(current))
            current += 1

    # For each account × month, count sync events
    cells = []
    for pair in pairs:
        a, b = pair["account_a"], pair["account_b"]
        if a not in top_accounts and b not in top_accounts:
            continue

        for url in pair["shared_urls"][:1]:  # approximate with first URL only
            ts     = pair["first_sync_ts"]
            month  = pd.to_datetime(ts, unit="s").to_period("M").strftime("%Y-%m")
            acct   = a if a in top_accounts else b
            cells.append({"account": acct, "month": month, "count": 1})

    cells_df = pd.DataFrame(cells) if cells else pd.DataFrame(
        columns=["account", "month", "count"]
    )
    if not cells_df.empty:
        cells_df = cells_df.groupby(["account", "month"]).sum().reset_index()

    return {
        "accounts": top_accounts,
        "months":   months,
        "cells":    cells_df.to_dict("records") if not cells_df.empty else [],
        "top_pairs": pairs[:20],  # top 20 for the table view
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir",   default="data")
    parser.add_argument("--out-public", default="public/data")
    parser.add_argument("--window",     type=int, default=WINDOW_MINUTES)
    parser.add_argument("--min-syncs",  type=int, default=MIN_SYNC_EVENTS)
    args = parser.parse_args()

    data_dir   = Path(args.data_dir)
    out_public = Path(args.out_public)
    out_public.mkdir(parents=True, exist_ok=True)

    print(f"\n── Step 5: Coordination ──────────────────────────────────────")
    print(f"  Window: {args.window} min · Min syncs: {args.min_syncs}")

    df = pd.read_parquet(data_dir / "posts_clean.parquet")

    pairs = find_coord_pairs(df, args.window, args.min_syncs)

    # ── Save raw pairs ───────────────────────────────────────────────────────
    pairs_df = pd.DataFrame(pairs)
    if not pairs_df.empty:
        pairs_df.to_parquet(data_dir / "coord_pairs.parquet", index=False)
        print(f"  Wrote {data_dir / 'coord_pairs.parquet'}")

    # ── Build + save heatmap ─────────────────────────────────────────────────
    heatmap = build_heatmap_data(pairs, df)
    (out_public / "coord.json").write_text(json.dumps(heatmap, default=str))
    print(f"  Wrote {out_public / 'coord.json'}")

    print(f"\n── Summary ───────────────────────────────────────────────────")
    print(f"  Flagged pairs:   {len(pairs):,}")
    if pairs:
        print(f"  Top pair:        {pairs[0]['account_a']} ↔ {pairs[0]['account_b']} "
              f"({pairs[0]['sync_count']} syncs)")
        print(f"  Avg gap (top 5): "
              f"{np.mean([p['avg_gap_min'] for p in pairs[:5]]):.1f} min")

    print(f"\nDone. Run scripts/06_graph.py next.\n")


if __name__ == "__main__":
    main()