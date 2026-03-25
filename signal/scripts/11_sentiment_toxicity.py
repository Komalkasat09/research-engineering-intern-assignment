import json
import importlib

import numpy as np
import pandas as pd
from transformers import pipeline

print("Loading models...")

# Sentiment: fast Twitter-tuned RoBERTa model.
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    truncation=True,
    max_length=512,
)

# Toxicity: Detoxify original model.
detoxify_mod = importlib.import_module("detoxify")
Detoxify = getattr(detoxify_mod, "Detoxify")
toxicity_model = Detoxify("original")

# Load posts + topic assignments.
posts = pd.read_parquet("data/posts_clean.parquet")
umap = pd.read_parquet("data/umap_2d.parquet")
merged = posts.merge(umap[["post_id", "topic_id"]], on="post_id", how="left")

# Parse dates.
merged["date"] = pd.to_datetime(
    merged["created_utc"].astype(float), unit="s", errors="coerce"
)
merged["month"] = merged["date"].dt.to_period("M").astype(str)

print(f"Scoring {len(merged)} posts...")

batch_size = 64
texts = merged["text"].fillna("").astype(str).tolist()

# Sentiment scoring in batches.
sentiments: list[float] = []
for i in range(0, len(texts), batch_size):
    batch = [t[:512] for t in texts[i : i + batch_size]]
    try:
        preds = sentiment_pipe(batch)
        for pred in preds:
            label = str(pred.get("label", "")).lower()
            score = float(pred.get("score", 0.0))
            if "positive" in label:
                sentiments.append(round(score, 4))
            elif "negative" in label:
                sentiments.append(round(-score, 4))
            else:
                sentiments.append(0.0)
    except Exception:
        sentiments.extend([0.0] * len(batch))

    if i % 500 == 0:
        print(f"  sentiment: {i}/{len(texts)}")

# Toxicity scoring in batches.
toxicities: list[float] = []
for i in range(0, len(texts), batch_size):
    batch = texts[i : i + batch_size]
    try:
        res = toxicity_model.predict(batch)
        toxicities.extend([round(float(t), 4) for t in res["toxicity"]])
    except Exception:
        toxicities.extend([0.0] * len(batch))

    if i % 500 == 0:
        print(f"  toxicity: {i}/{len(texts)}")

merged["sentiment"] = sentiments[: len(merged)]
merged["toxicity"] = toxicities[: len(merged)]

lifecycle: list[dict] = []
valid_topic_ids = sorted(
    [
        int(t)
        for t in merged["topic_id"].dropna().unique().tolist()
        if int(t) != -1
    ]
)

for topic_id in valid_topic_ids:
    cluster = merged[merged["topic_id"] == topic_id].copy()
    if cluster.empty:
        continue

    avg_sentiment = float(cluster["sentiment"].mean())
    avg_toxicity = float(cluster["toxicity"].mean())

    most_toxic = cluster.nlargest(1, "toxicity").iloc[0]
    most_viral = cluster.nlargest(1, "score").iloc[0]

    cluster_sorted = cluster.sort_values("date")
    n = len(cluster_sorted)
    phases: list[dict] = []
    phase_names = ["Emergence", "Growth", "Peak", "Saturation"]

    for pi in range(4):
        start = pi * n // 4
        end = (pi + 1) * n // 4
        chunk = cluster_sorted.iloc[start:end]
        if chunk.empty:
            continue

        phases.append(
            {
                "phase": phase_names[pi],
                "post_count": int(len(chunk)),
                "date_start": str(chunk["date"].min())[:7],
                "date_end": str(chunk["date"].max())[:7],
                "avg_sentiment": round(float(chunk["sentiment"].mean()), 3),
                "avg_toxicity": round(float(chunk["toxicity"].mean()), 3),
            }
        )

    monthly: list[dict] = []
    for month, grp in cluster.groupby("month"):
        monthly.append(
            {
                "month": month,
                "post_count": int(len(grp)),
                "avg_sentiment": round(float(grp["sentiment"].mean()), 3),
                "avg_toxicity": round(float(grp["toxicity"].mean()), 3),
                "max_toxicity": round(float(grp["toxicity"].max()), 3),
            }
        )

    lifecycle.append(
        {
            "topic_id": int(topic_id),
            "avg_sentiment": round(avg_sentiment, 3),
            "avg_toxicity": round(avg_toxicity, 3),
            "phases": phases,
            "monthly": sorted(monthly, key=lambda x: x["month"]),
            "most_toxic_post": {
                "text": str(most_toxic.get("text", ""))[:300],
                "author": str(most_toxic.get("author", "")),
                "subreddit": str(most_toxic.get("subreddit", "")),
                "score": int(most_toxic.get("score", 0)),
                "date": str(most_toxic["date"])[:10],
                "toxicity": round(float(most_toxic["toxicity"]), 3),
                "sentiment": round(float(most_toxic["sentiment"]), 3),
            },
            "most_viral_post": {
                "text": str(most_viral.get("text", ""))[:300],
                "author": str(most_viral.get("author", "")),
                "subreddit": str(most_viral.get("subreddit", "")),
                "score": int(most_viral.get("score", 0)),
                "date": str(most_viral["date"])[:10],
                "toxicity": round(float(most_viral["toxicity"]), 3),
                "sentiment": round(float(most_viral["sentiment"]), 3),
            },
        }
    )

rage_numer = merged.loc[merged["toxicity"] > 0.7, "score"].mean()
rage_denom = merged.loc[merged["toxicity"] <= 0.7, "score"].mean()
rage_multiplier = float((rage_numer if np.isfinite(rage_numer) else 0.0) / max((rage_denom if np.isfinite(rage_denom) else 0.0), 1.0))

cluster_means = merged.groupby("topic_id")["toxicity"].mean().drop(-1, errors="ignore")
most_toxic_cluster = int(cluster_means.idxmax()) if not cluster_means.empty else -1

output = {
    "lifecycle": lifecycle,
    "corpus_stats": {
        "avg_sentiment": round(float(merged["sentiment"].mean()), 3),
        "avg_toxicity": round(float(merged["toxicity"].mean()), 3),
        "high_toxicity_count": int((merged["toxicity"] > 0.7).sum()),
        "rage_amplification": round(rage_multiplier, 2),
        "most_toxic_cluster": most_toxic_cluster,
    },
}

with open("public/data/lifecycle.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2)

print(f"Saved lifecycle data for {len(lifecycle)} clusters")
print("Corpus stats:", output["corpus_stats"])
