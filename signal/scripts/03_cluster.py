from pathlib import Path
import json

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from bertopic import BERTopic
from umap import UMAP
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer


def cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
    an = np.linalg.norm(a)
    bn = np.linalg.norm(b)
    if an == 0.0 or bn == 0.0:
        return 0.0
    return float(1.0 - np.dot(a, b) / (an * bn))


def to_iso_week(created_utc: pd.Series) -> pd.Series:
    # Primary path for this dataset: unix epoch seconds (float/int).
    ts = pd.to_datetime(created_utc, unit="s", errors="coerce", utc=True)

    # Fallback for already formatted datetime strings.
    if ts.notna().sum() == 0:
        ts = pd.to_datetime(created_utc, errors="coerce", utc=True)

    return ts.dt.strftime("%G-W%V")


def get_embeddings(docs: list[str]) -> np.ndarray:
    emb_path = Path("data/embeddings.npy")
    if emb_path.exists():
        emb = np.load(emb_path)
        if emb.shape[0] == len(docs):
            return emb.astype(np.float32)

    model = SentenceTransformer("all-MiniLM-L6-v2")
    emb = model.encode(docs, batch_size=64, show_progress_bar=True)
    emb = np.asarray(emb, dtype=np.float32)
    np.save(emb_path, emb)
    return emb


def main() -> None:
    Path("public/data").mkdir(parents=True, exist_ok=True)
    Path("data").mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet("data/posts_clean.parquet")
    docs = df["text"].fillna("").astype(str).tolist()

    embeddings = get_embeddings(docs)

    umap_5d = UMAP(n_components=5, metric="cosine", min_dist=0.0, random_state=42)
    umap_2d = UMAP(n_components=2, metric="cosine", min_dist=0.1, random_state=42)

    reduced_5d = umap_5d.fit_transform(embeddings)
    reduced_2d = umap_2d.fit_transform(embeddings)

    hdbscan = HDBSCAN(
        min_cluster_size=150,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )

    vectorizer = CountVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.95,
        max_features=10_000,
    )

    topic_model = BERTopic(
        umap_model=umap_5d,
        hdbscan_model=hdbscan,
        vectorizer_model=vectorizer,
        calculate_probabilities=False,
        verbose=False,
    )

    topics, _ = topic_model.fit_transform(docs, embeddings)

    df["topic_id"] = topics
    df["umap_x"] = reduced_2d[:, 0]
    df["umap_y"] = reduced_2d[:, 1]

    # Parse weekly keys robustly from created_utc format.
    df["iso_week"] = to_iso_week(df["created_utc"])

    umap_cols = ["post_id", "umap_x", "umap_y", "topic_id", "score", "created_utc", "iso_week"]
    df[umap_cols].to_parquet("public/data/umap_2d.parquet", index=False)
    df[umap_cols].to_parquet("data/umap_2d.parquet", index=False)

    # Build topics.json (cluster metadata + dataset meta).
    topic_info = topic_model.get_topic_info()
    palette = [
        "#1D9E75", "#7F77DD", "#BA7517", "#D85A30", "#888780",
        "#D4537E", "#378ADD", "#639922", "#E24B4A", "#5DCAA5",
    ]

    valid_topics = sorted(int(t) for t in pd.Series(topics).unique() if int(t) >= 0)
    topics_json: list[dict] = []

    for i, tid in enumerate(valid_topics):
        mask = df["topic_id"] == tid
        name_row = topic_info.loc[topic_info["Topic"] == tid, "Name"]
        name = str(name_row.iloc[0]) if len(name_row) else f"topic_{tid}"
        words = [w for w, _ in (topic_model.get_topic(tid) or [])[:8]]

        topics_json.append(
            {
                "id": tid,
                "name": name,
                "top_words": words,
                "count": int(mask.sum()),
                "color": palette[i % len(palette)],
                "centroid_x": float(df.loc[mask, "umap_x"].mean()),
                "centroid_y": float(df.loc[mask, "umap_y"].mean()),
            }
        )

    ts = pd.to_datetime(df["created_utc"], unit="s", errors="coerce", utc=True)
    if ts.notna().sum() == 0:
        ts = pd.to_datetime(df["created_utc"], errors="coerce", utc=True)

    meta = {
        "total_posts": int(len(df)),
        "date_start": str(ts.min().date()) if ts.notna().any() else "unknown",
        "date_end": str(ts.max().date()) if ts.notna().any() else "unknown",
        "subreddits": int(df["subreddit"].nunique()) if "subreddit" in df.columns else 0,
        "unique_authors": int(df["author"].nunique()) if "author" in df.columns else 0,
        "topic_count": int(len(valid_topics)),
    }

    with open("public/data/topics.json", "w") as f:
        json.dump({"topics": topics_json, "meta": meta}, f)

    # Compute weekly centroid drift per topic.
    tmp = df[["topic_id", "iso_week"]].copy()
    tmp["idx"] = np.arange(len(df))
    tmp = tmp[(tmp["topic_id"] >= 0) & tmp["iso_week"].notna()]

    velocity_records: list[dict] = []

    for tid in valid_topics:
        by_topic = tmp[tmp["topic_id"] == tid]
        prev_centroid = None

        for week, g in by_topic.groupby("iso_week", sort=True):
            idx = g["idx"].to_numpy(dtype=int)
            centroid = embeddings[idx].mean(axis=0)
            vel = 0.0 if prev_centroid is None else cosine_distance(prev_centroid, centroid)

            velocity_records.append(
                {
                    "week": str(week),
                    "topic_id": int(tid),
                    "velocity": round(float(vel), 4),
                    "post_count": int(len(idx)),
                }
            )

            prev_centroid = centroid

    with open("public/data/velocity.json", "w") as f:
        json.dump(velocity_records, f)

    topic_model.save("data/bertopic_model")

    print(topic_info[["Topic", "Count", "Name"]].to_string())
    print(f"\nWrote public/data/velocity.json with {len(velocity_records)} entries")


if __name__ == "__main__":
    main()
