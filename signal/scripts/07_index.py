"""
07_index.py — Build FAISS vector index for RAG chatbot retrieval.

The chatbot (Step 5) uses this index to find semantically similar posts
before generating a response. This gives Claude real evidence to cite
rather than hallucinating specifics.

Index type: IndexFlatIP (Inner Product on L2-normalised vectors = cosine sim)
  - No approximate search (IVF, HNSW) needed up to ~1M vectors on CPU
  - IndexFlatIP is exact, fast enough for <100ms queries at this scale

Output:
    data/faiss.index         — FAISS binary index
    data/faiss_meta.json     — maps index row → {post_id, text[:200], author,
                               subreddit, topic_id, created_utc, score}

Usage:
    python scripts/07_index.py
    python scripts/07_index.py --sample 100000  # index only 100k posts (faster demo)
"""

import argparse
import json
from pathlib import Path

import faiss
import numpy as np
import pandas as pd
from tqdm import tqdm


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--sample",   type=int, default=None,
                        help="Index only N posts (for faster demo deploys)")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)

    print(f"\n── Step 7: FAISS Index ───────────────────────────────────────")

    # ── Load embeddings ──────────────────────────────────────────────────────
    embs = np.load(data_dir / "embeddings.npy").astype(np.float32)
    meta = json.loads((data_dir / "embed_meta.json").read_text())
    post_ids = meta["post_ids"]

    assert embs.shape[0] == len(post_ids), "Embedding count != post count"

    # ── Optional: subsample for demo ─────────────────────────────────────────
    if args.sample and args.sample < len(post_ids):
        # Sample deterministically: take every Nth row to preserve distribution
        step    = len(post_ids) // args.sample
        indices = np.arange(0, len(post_ids), step)[: args.sample]
        embs     = embs[indices]
        post_ids = [post_ids[i] for i in indices]
        print(f"  Sampled {len(post_ids):,} posts (1 in {step})")
    else:
        print(f"  Indexing all {len(post_ids):,} posts")

    # ── Build FAISS index ────────────────────────────────────────────────────
    dim = embs.shape[1]
    print(f"  Building IndexFlatIP (dim={dim})...")

    # Verify embeddings are L2-normalised (from 02_embed.py --normalize)
    norms = np.linalg.norm(embs, axis=1)
    if not np.allclose(norms, 1.0, atol=1e-3):
        print("  Re-normalising embeddings...")
        embs = embs / norms[:, np.newaxis]

    index = faiss.IndexFlatIP(dim)
    index.add(embs)
    print(f"  Index built: {index.ntotal:,} vectors")

    # ── Save index ───────────────────────────────────────────────────────────
    idx_path = data_dir / "faiss.index"
    faiss.write_index(index, str(idx_path))
    print(f"  Wrote {idx_path} ({idx_path.stat().st_size / 1e6:.0f} MB)")

    # ── Build metadata lookup ────────────────────────────────────────────────
    # Load posts + topic assignments for retrieval context
    posts_df = pd.read_parquet(data_dir / "posts_clean.parquet")
    umap_df  = pd.read_parquet(data_dir / "umap_2d.parquet")[["post_id", "topic_id"]]
    merged   = posts_df.merge(umap_df, on="post_id", how="left")
    merged   = merged.set_index("post_id")

    # Build id → row metadata dict (text truncated to 300 chars for context window)
    index_meta = {}
    for pid in tqdm(post_ids, desc="Building metadata"):
        if pid not in merged.index:
            index_meta[pid] = {"post_id": pid, "text": "", "author": "unknown"}
            continue
        row = merged.loc[pid]
        index_meta[pid] = {
            "post_id":    pid,
            "text":       str(row.get("text", ""))[:300],
            "author":     str(row.get("author", "")),
            "subreddit":  str(row.get("subreddit", "")),
            "topic_id":   int(row.get("topic_id", -1)),
            "created_utc":int(row.get("created_utc", 0)),
            "score":      int(row.get("score", 0)),
        }

    # Save as ordered list (index row → metadata)
    ordered_meta = [index_meta.get(pid, {"post_id": pid}) for pid in post_ids]
    meta_path = data_dir / "faiss_meta.json"

    # Write in chunks to avoid memory spike
    with open(meta_path, "w") as f:
        json.dump({"n": len(ordered_meta), "posts": ordered_meta}, f)
    print(f"  Wrote {meta_path} ({meta_path.stat().st_size / 1e6:.0f} MB)")

    # ── Quick retrieval test ─────────────────────────────────────────────────
    print("\n  Retrieval test: querying with first embedding...")
    D, I = index.search(embs[:1], k=5)
    print(f"  Top-5 cosine similarities: {D[0].round(4).tolist()}")
    print(f"  Top-5 indices:             {I[0].tolist()}")

    print(f"\nAll pipeline steps complete!")
    print(f"Run `npm run dev` and open http://localhost:3000\n")


if __name__ == "__main__":
    main()