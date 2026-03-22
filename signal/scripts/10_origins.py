"""
10_origins.py — Export narrative-origin summaries per topic cluster.

Builds public/data/origins.json from posts_clean.parquet + umap_2d.parquet.
For each topic cluster, computes:
- first post overall
- origin subreddit (first subreddit in time)
- spread timing to other subreddits
- top post by score
- earliest five posts
"""

import json
from pathlib import Path

import pandas as pd


TOPIC_COLORS = {
    0: "#1D9E75", 1: "#7F77DD", 2: "#BA7517", 3: "#D85A30",
    4: "#888780", 5: "#D4537E", 6: "#378ADD", 7: "#639922",
    8: "#E24B4A", 9: "#5DCAA5",
}


def format_post(row: pd.Series) -> dict:
    date_val = row.get("date")
    if pd.isna(date_val):
        date = "unknown"
    else:
        date = pd.Timestamp(date_val).strftime("%Y-%m-%d")

    return {
        "author": str(row.get("author", "")),
        "subreddit": str(row.get("subreddit", "")),
        "text": str(row.get("text", ""))[:280],
        "date": date,
        "score": int(row.get("score", 0) or 0),
    }


def main() -> None:
    posts = pd.read_parquet("data/posts_clean.parquet")
    umap = pd.read_parquet("data/umap_2d.parquet")

    merged = posts.merge(umap[["post_id", "topic_id"]], on="post_id", how="left")

    # Parse timestamps
    merged["date"] = pd.to_datetime(
        merged["created_utc"].astype(float),
        unit="s",
        errors="coerce",
    )

    topic_meta = {}
    topics_path = Path("public/data/topics.json")
    if topics_path.exists():
        try:
            parsed = json.loads(topics_path.read_text())
            for t in parsed.get("topics", []):
                topic_meta[int(t.get("id", -999))] = {
                    "name": t.get("name", ""),
                    "color": t.get("color", ""),
                }
        except Exception:
            topic_meta = {}

    results = []
    topic_ids = sorted({int(t) for t in merged["topic_id"].dropna().unique()})

    for topic_id in topic_ids:
        if topic_id == -1:
            continue

        cluster = merged[merged["topic_id"] == topic_id].sort_values("date")
        if cluster.empty:
            continue

        # First post overall
        first = cluster.iloc[0]

        # First post per subreddit
        first_by_sub = (
            cluster.groupby("subreddit", as_index=False)
            .first()
            .sort_values("date")
        )
        if first_by_sub.empty:
            continue

        origin_sub = str(first_by_sub.iloc[0]["subreddit"])
        origin_date = first_by_sub.iloc[0]["date"]

        # Spread timing
        spread = []
        for _, row in first_by_sub.iterrows():
            sub = str(row.get("subreddit", ""))
            if sub == origin_sub:
                continue
            date_val = row.get("date")
            if pd.isna(date_val) or pd.isna(origin_date):
                continue
            days = int((pd.Timestamp(date_val) - pd.Timestamp(origin_date)).days)
            spread.append({"subreddit": sub, "days_after": max(days, 0)})

        # Top post by score
        top = cluster.fillna({"score": 0}).nlargest(1, "score").iloc[0]

        earliest_posts = [format_post(r) for _, r in cluster.head(5).iterrows()]
        spread = sorted(spread, key=lambda x: x["days_after"])

        meta = topic_meta.get(topic_id, {})

        results.append({
            "topic_id": int(topic_id),
            "name": meta.get("name") or f"topic {topic_id}",
            "color": meta.get("color") or TOPIC_COLORS.get(topic_id, "#3A4148"),
            "origin_subreddit": origin_sub,
            "first_date": format_post(first)["date"],
            "days_to_spread": int(spread[0]["days_after"]) if spread else 0,
            "spread_to": [s["subreddit"] for s in spread],
            "spread_detail": spread[:4],
            "first_post": format_post(first),
            "top_post": format_post(top),
            "earliest_posts": earliest_posts,
        })

    out_path = Path("public/data/origins.json")
    out_path.write_text(json.dumps({"clusters": results}, indent=2))

    print(f"Generated origins for {len(results)} clusters")


if __name__ == "__main__":
    main()
