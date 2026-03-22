"""
06_graph.py — Build account co-posting network + compute PageRank.

Nodes: accounts and subreddits
Edges: account posted in subreddit (weight = post count)
       account mentioned another account (weight = mention count)

Community detection: Louvain algorithm on the weighted graph.
Influence metric: PageRank (standard, damping=0.85).

Output:
    data/graph.pkl               — NetworkX graph object
    public/data/graph.json       — D3 force-graph ready {nodes, links}

Usage:
    python scripts/06_graph.py
    python scripts/06_graph.py --min-posts 5 --max-nodes 2000
"""

import argparse
import json
import pickle
from pathlib import Path

import networkx as nx
import pandas as pd
import numpy as np
from tqdm import tqdm

try:
    import community as community_louvain   # python-louvain
    HAS_LOUVAIN = True
except ImportError:
    HAS_LOUVAIN = False
    print("  Warning: python-louvain not installed — skipping community detection")


TOPIC_COLORS = {
    0: "#1D9E75", 1: "#7F77DD", 2: "#BA7517", 3: "#D85A30",
    4: "#888780", 5: "#D4537E", 6: "#378ADD", 7: "#639922",
    8: "#E24B4A", 9: "#5DCAA5",
}


def load_topic_assignments(data_dir: Path) -> dict[str, int]:
    """Load account→topic mapping from umap_2d.parquet."""
    umap_path = data_dir / "umap_2d.parquet"
    if not umap_path.exists():
        print("  Warning: umap_2d.parquet not found, topic_id will be -1")
        return {}

    df = pd.read_parquet(umap_path)
    if "author" not in df.columns:
        # Try merging with posts_clean to get author
        posts_path = data_dir / "posts_clean.parquet"
        if posts_path.exists():
            posts = pd.read_parquet(posts_path)[["post_id", "author"]]
            df = df.merge(posts, on="post_id", how="left")
        else:
            return {}

    if "topic_id" not in df.columns:
        return {}

    # For each author, get their most common topic_id (mode)
    author_topics = (
        df[df["topic_id"] != -1]
        .groupby("author")["topic_id"]
        .agg(lambda x: x.mode().iloc[0] if len(x) > 0 else -1)
        .to_dict()
    )
    print(f"  Loaded topic assignments for {len(author_topics)} authors")
    return author_topics


def build_graph(df: pd.DataFrame, min_posts: int, data_dir: Path) -> nx.Graph:
    """
    Build bipartite account↔subreddit graph.
    Prune accounts with < min_posts total to keep the graph tractable.
    """
    G = nx.Graph()
    author_topics = load_topic_assignments(data_dir)

    # Account post counts
    account_counts = df.groupby("author").size()
    active_accounts = account_counts[account_counts >= min_posts].index
    df_filtered = df[df["author"].isin(active_accounts)]

    print(f"  Active accounts (≥{min_posts} posts): {len(active_accounts):,}")

    # Build subreddit -> dominant topic map from post/topic assignments.
    sub_topics: dict[str, int] = {}
    posts_path = data_dir / "posts_clean.parquet"
    umap_path = data_dir / "umap_2d.parquet"
    if posts_path.exists() and umap_path.exists():
        posts_df = pd.read_parquet(posts_path)
        umap_df = pd.read_parquet(umap_path)
        if (
            "post_id" in posts_df.columns and "subreddit" in posts_df.columns and
            "post_id" in umap_df.columns and "topic_id" in umap_df.columns
        ):
            merged = posts_df[["post_id", "subreddit"]].merge(
                umap_df[["post_id", "topic_id"]], on="post_id", how="left"
            )
            sub_topics = (
                merged[merged["topic_id"] != -1]
                .groupby("subreddit")["topic_id"]
                .agg(lambda x: x.mode().iloc[0] if len(x) > 0 else -1)
                .to_dict()
            )

    # Add subreddit nodes
    subreddits = df_filtered["subreddit"].unique()
    for sub in subreddits:
        sub_count = (df_filtered["subreddit"] == sub).sum()
        topic_id = int(sub_topics.get(sub, -1))
        G.add_node(
            sub,
            label=sub,
            type="subreddit",
            post_count=int(sub_count),
            topic_id=topic_id,
        )

    # Add account nodes + edges to subreddits
    for author, grp in tqdm(df_filtered.groupby("author"), desc="Adding nodes"):
        topic_id = int(author_topics.get(author, -1))

        G.add_node(
            author,
            label=author,
            type="account",
            post_count=int(len(grp)),
            topic_id=topic_id,
        )

        # Edge per subreddit the account posted in
        for sub, sub_grp in grp.groupby("subreddit"):
            weight = len(sub_grp)
            if G.has_edge(author, sub):
                G[author][sub]["weight"] += weight
            else:
                G.add_edge(author, sub, weight=weight, type="co_post")

    print(f"  Graph: {G.number_of_nodes():,} nodes · {G.number_of_edges():,} edges")
    return G


def compute_pagerank(G: nx.Graph) -> dict[str, float]:
    """Standard PageRank with damping=0.85."""
    print("  Computing PageRank...")
    pr = nx.pagerank(G, alpha=0.85, weight="weight", max_iter=200)
    top = sorted(pr.items(), key=lambda x: x[1], reverse=True)[:5]
    print(f"  Top 5 by PageRank: {[(n, round(s, 5)) for n, s in top]}")
    return pr


def detect_communities(G: nx.Graph) -> dict[str, int]:
    """Louvain community detection on the weighted graph."""
    if not HAS_LOUVAIN:
        return {n: 0 for n in G.nodes}

    print("  Running Louvain community detection...")
    partition = community_louvain.best_partition(G, weight="weight", random_state=42)
    n_communities = len(set(partition.values()))
    print(f"  Found {n_communities} communities")
    return partition


def to_d3_format(
    G: nx.Graph,
    pagerank: dict[str, float],
    partition: dict[str, int],
    max_nodes: int,
) -> dict:
    """
    Convert NetworkX graph to D3 force-graph format.
    Limits to max_nodes to keep the frontend responsive.
    Sorts by PageRank so we keep the most influential nodes.
    """
    # Select top nodes by PageRank
    top_nodes = sorted(G.nodes, key=lambda n: pagerank.get(n, 0), reverse=True)
    top_nodes = top_nodes[:max_nodes]
    node_set  = set(top_nodes)

    nodes = []
    for n in top_nodes:
        attrs = G.nodes[n]
        nodes.append({
            "id":          n,
            "label":       attrs.get("label", n),
            "type":        attrs.get("type", "account"),
            "weight":      round(pagerank.get(n, 0), 6),
            "topic_id":    attrs.get("topic_id", -1),
            "post_count":  attrs.get("post_count", 0),
            "community":   partition.get(n, 0),
            "color":       TOPIC_COLORS.get(attrs.get("topic_id", -1), "#3A4148"),
        })

    # Only include edges where both endpoints are in top_nodes
    links = []
    for u, v, data in G.edges(data=True):
        if u in node_set and v in node_set:
            links.append({
                "source": u,
                "target": v,
                "weight": int(data.get("weight", 1)),
                "type":   data.get("type", "co_post"),
            })

    return {"nodes": nodes, "links": links}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir",   default="data")
    parser.add_argument("--out-public", default="public/data")
    parser.add_argument("--min-posts",  type=int, default=3)
    parser.add_argument("--max-nodes",  type=int, default=2000)
    args = parser.parse_args()

    data_dir   = Path(args.data_dir)
    out_public = Path(args.out_public)
    out_public.mkdir(parents=True, exist_ok=True)

    print(f"\n── Step 6: Graph ─────────────────────────────────────────────")

    df = pd.read_parquet(data_dir / "posts_clean.parquet")

    G         = build_graph(df, min_posts=args.min_posts, data_dir=data_dir)
    pagerank  = compute_pagerank(G)
    partition = detect_communities(G)

    # Save NetworkX graph
    with open(data_dir / "graph.pkl", "wb") as f:
        pickle.dump(G, f)
    print(f"  Saved {data_dir / 'graph.pkl'}")

    # Export D3 format
    d3_data = to_d3_format(G, pagerank, partition, max_nodes=args.max_nodes)
    (out_public / "graph.json").write_text(json.dumps(d3_data))
    print(f"  Wrote {out_public / 'graph.json'} "
          f"({len(d3_data['nodes'])} nodes · {len(d3_data['links'])} edges)")

    print(f"\nDone. Run scripts/07_index.py next.\n")


if __name__ == "__main__":
    main()