"""
02_embed.py — Generate sentence embeddings for all posts.

Uses sentence-transformers/all-MiniLM-L6-v2:
  - 384-dimensional embeddings
  - ~14k sentences/sec on CPU, ~60k/sec on GPU
  - Excellent quality/speed tradeoff for social media text

Output:
    data/embeddings.npy   — float32 array, shape (N, 384)
    data/embed_meta.json  — maps array row → post_id

Usage:
    python scripts/02_embed.py
    python scripts/02_embed.py --batch-size 128 --device cuda
"""

import argparse
import json
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from tqdm import tqdm


MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input",      default="data/posts_clean.parquet")
    parser.add_argument("--outdir",     default="data")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--device",     default="cpu", choices=["cpu", "cuda", "mps"])
    parser.add_argument("--resume",     action="store_true",
                        help="Skip already-embedded rows if embeddings.npy exists")
    args = parser.parse_args()

    out_dir = Path(args.outdir)
    out_dir.mkdir(parents=True, exist_ok=True)

    emb_path  = out_dir / "embeddings.npy"
    meta_path = out_dir / "embed_meta.json"

    # ── Load posts ──────────────────────────────────────────────────────────
    print(f"\n── Step 2: Embed ─────────────────────────────────────────────")
    df = pd.read_parquet(args.input)
    print(f"  Loaded {len(df):,} posts from {args.input}")

    # ── Resume logic ────────────────────────────────────────────────────────
    # If we were interrupted mid-run, skip rows we already processed
    start_idx = 0
    existing_embs: np.ndarray | None = None

    if args.resume and emb_path.exists() and meta_path.exists():
        existing_embs = np.load(emb_path)
        existing_meta = json.loads(meta_path.read_text())
        start_idx     = len(existing_meta["post_ids"])
        print(f"  Resuming from row {start_idx:,} (already have {start_idx:,} embeddings)")
        df = df.iloc[start_idx:]

    if len(df) == 0:
        print("  Nothing to embed — already complete.")
        return

    # ── Load model ──────────────────────────────────────────────────────────
    print(f"  Loading model: {MODEL_ID} on {args.device}...")
    model = SentenceTransformer(MODEL_ID, device=args.device)

    # ── Embed ────────────────────────────────────────────────────────────────
    texts = df["text"].tolist()
    print(f"  Encoding {len(texts):,} texts (batch_size={args.batch_size})...")

    t0 = time.time()
    embeddings = model.encode(
        texts,
        batch_size=args.batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,   # L2-normalise for cosine similarity via dot product
        convert_to_numpy=True,
    )
    elapsed = time.time() - t0
    rate    = len(texts) / elapsed
    print(f"  Encoded {len(texts):,} texts in {elapsed:.1f}s ({rate:,.0f} texts/sec)")
    print(f"  Embedding shape: {embeddings.shape}, dtype: {embeddings.dtype}")

    # ── Merge with existing if resuming ─────────────────────────────────────
    if existing_embs is not None:
        embeddings = np.vstack([existing_embs, embeddings])
        # Reload full df for meta
        full_df = pd.read_parquet(args.input)
        post_ids = full_df["post_id"].tolist()
    else:
        full_df  = pd.read_parquet(args.input)  # re-read for complete post_ids
        post_ids = full_df["post_id"].tolist()

    # ── Save ─────────────────────────────────────────────────────────────────
    np.save(emb_path, embeddings.astype(np.float32))
    print(f"  Saved {emb_path} ({emb_path.stat().st_size / 1e9:.2f} GB)")

    meta_path.write_text(json.dumps({
        "model":    MODEL_ID,
        "dim":      embeddings.shape[1],
        "n":        embeddings.shape[0],
        "post_ids": post_ids,
        "normalised": True,
    }, indent=2))
    print(f"  Saved {meta_path}")

    # ── Quick sanity check ───────────────────────────────────────────────────
    # Two similar posts should have cosine similarity > 0.7
    # (since embeddings are L2-normalised, dot product = cosine similarity)
    sample_a = embeddings[0]
    sample_b = embeddings[min(1, len(embeddings) - 1)]
    sim = float(np.dot(sample_a, sample_b))
    print(f"\n  Sanity check — cosine sim between row 0 and row 1: {sim:.4f}")
    print(f"  (Expected ~0.3–0.9 for posts from the same platform)")

    print(f"\nDone. Run scripts/03_cluster.py next.\n")


if __name__ == "__main__":
    main()