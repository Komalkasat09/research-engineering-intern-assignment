"""
04_stance.py — Zero-shot stance classification via NLI.

Model: cross-encoder/nli-deberta-v3-small
  - 184M params, fast inference, strong zero-shot NLI
  - No fine-tuning needed — we frame stance as entailment

Premise: "This post expresses support for climate action."
  - Entailment   > THRESHOLD → "pro"
  - Contradiction > THRESHOLD → "con"
  - Otherwise                 → "neutral"

After manual review of 100 posts, threshold=0.55 gives best
precision/recall on "neutral" vs borderline cases.

Output:
    data/stance.parquet              — per-post labels + scores
    public/data/stance_series.json   — weekly pro/neutral/con fractions
                                       per topic (for the stance river chart)

Usage:
    python scripts/04_stance.py
    python scripts/04_stance.py --batch-size 16 --threshold 0.55
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from transformers import pipeline
from tqdm import tqdm


MODEL_ID  = "cross-encoder/nli-deberta-v3-small"
PREMISE   = "This post expresses support for the current US government administration and its policies"
THRESHOLD = 0.55


def classify_batch(pipe, texts: list[str]) -> list[dict]:
    """
    Run NLI on a batch.
    Returns list of {"stance": str, "pro": float, "con": float, "neutral": float}
    """
    # NLI pipeline expects list of (premise, hypothesis) pairs
    pairs = [{"text": PREMISE, "text_pair": t} for t in texts]
    outputs = pipe(pairs)

    results = []
    for out in outputs:
        scores = {item["label"].lower(): item["score"] for item in out}
        pro_score = scores.get("entailment",    0.0)
        con_score = scores.get("contradiction", 0.0)
        neu_score = scores.get("neutral",       0.0)

        if pro_score >= THRESHOLD:
            stance = "pro"
        elif con_score >= THRESHOLD:
            stance = "con"
        else:
            stance = "neutral"

        results.append({
            "stance":        stance,
            "pro_score":     round(pro_score, 4),
            "con_score":     round(con_score, 4),
            "neutral_score": round(neu_score, 4),
        })
    return results


def build_stance_series(df: pd.DataFrame) -> list[dict]:
    """
    Aggregate per-post stances into weekly fractions per topic.
    This is what the D3 streamgraph reads.
    """
    df = df.copy()
    df["week"] = pd.to_datetime(df["created_utc"], unit="s").dt.to_period("W").astype(str)

    results = []
    for (week, topic_id), grp in df.groupby(["week", "topic_id"]):
        total = len(grp)
        if total == 0:
            continue
        results.append({
            "week":     week,
            "topic_id": int(topic_id),
            "pro":      round(len(grp[grp["stance"] == "pro"])     / total, 4),
            "neutral":  round(len(grp[grp["stance"] == "neutral"]) / total, 4),
            "con":      round(len(grp[grp["stance"] == "con"])     / total, 4),
            "n":        total,
        })
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir",   default="data")
    parser.add_argument("--out-public", default="public/data")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--threshold",  type=float, default=THRESHOLD)
    parser.add_argument("--device",     default="cpu")
    args = parser.parse_args()

    data_dir   = Path(args.data_dir)
    out_public = Path(args.out_public)
    out_public.mkdir(parents=True, exist_ok=True)

    # ── Load ────────────────────────────────────────────────────────────────
    print(f"\n── Step 4: Stance ────────────────────────────────────────────")
    umap_df = pd.read_parquet(data_dir / "umap_2d.parquet")
    posts_df = pd.read_parquet(data_dir / "posts_clean.parquet")

    df = posts_df[["post_id", "text", "created_utc"]].merge(
        umap_df[["post_id", "topic_id"]], on="post_id", how="inner"
    )
    # Only classify posts in real topic clusters (skip noise -1)
    df = df[df["topic_id"] != -1].reset_index(drop=True)
    print(f"  Classifying {len(df):,} posts (topic_id != -1)")

    # ── Load model ──────────────────────────────────────────────────────────
    device = 0 if args.device == "cuda" and torch.cuda.is_available() else -1
    print(f"  Loading {MODEL_ID} on {'GPU' if device == 0 else 'CPU'}...")
    pipe = pipeline(
        "text-classification",
        model=MODEL_ID,
        device=device,
        top_k=None,         # return all labels (entailment + contradiction + neutral)
        truncation=True,
        max_length=256,
    )

    # ── Classify in batches ──────────────────────────────────────────────────
    all_results: list[dict] = []
    texts = df["text"].tolist()

    for i in tqdm(range(0, len(texts), args.batch_size), desc="Classifying"):
        batch = texts[i : i + args.batch_size]
        all_results.extend(classify_batch(pipe, batch))

    # ── Attach results ───────────────────────────────────────────────────────
    stance_df = pd.DataFrame(all_results)
    df = pd.concat([df.reset_index(drop=True), stance_df], axis=1)

    # ── Save per-post labels ─────────────────────────────────────────────────
    out_path = data_dir / "stance.parquet"
    df[["post_id", "topic_id", "created_utc",
        "stance", "pro_score", "con_score", "neutral_score"]
    ].to_parquet(out_path, index=False, compression="zstd")
    print(f"\n  Wrote {out_path}")

    # ── Build + save weekly series ───────────────────────────────────────────
    series = build_stance_series(df)
    out_series = out_public / "stance_series.json"
    out_series.write_text(json.dumps(series))
    print(f"  Wrote {out_series} ({len(series):,} data points)")

    # ── Summary ─────────────────────────────────────────────────────────────
    counts = df["stance"].value_counts()
    total  = len(df)
    print(f"\n── Stance distribution ───────────────────────────────────────")
    for stance in ["pro", "neutral", "con"]:
        n   = counts.get(stance, 0)
        pct = n / total * 100
        print(f"  {stance:8s}: {n:>8,}  ({pct:.1f}%)")
    print(f"\nDone. Run scripts/05_coord.py next.\n")


if __name__ == "__main__":
    main()