/**
 * mapData.ts — Fetches and caches all data needed by the narrative map.
 *
 * Loading strategy:
 *   1. Fetch topics.json  (cluster metadata, ~10 KB)
 *   2. Fetch umap_2d.parquet via /api/umap  (per-point coords, streamed)
 *
 * For the hosted demo without a Python pipeline, /api/umap returns
 * synthetic points so the canvas still renders meaningfully.
 *
 * Returns data already scaled to pixel space so the Pixi canvas
 * doesn't need to know about UMAP coordinate ranges.
 */

import type { TopicCluster } from "@/types";

export interface MapPoint {
  x:        number;   // pixel-space, 0..canvasW
  y:        number;   // pixel-space, 0..canvasH
  topicId:  number;
  score:    number;   // post upvotes (drives point size)
  postId:   string;
}

export interface MapData {
  points:   MapPoint[];
  clusters: TopicCluster[];
  meta: {
    total_posts:     number;
    date_start:      string;
    date_end:        string;
    subreddits:      number;
    unique_authors:  number;
    topic_count:     number;
  };
}

// ── Topic cluster type (local, matches API response) ─────────────────────────
interface RawCluster {
  id:         number;
  name:       string;
  top_words:  string[];
  count:      number;
  color:      string;
  centroid_x: number;
  centroid_y: number;
}

// ── Raw point from API ────────────────────────────────────────────────────────
interface RawPoint {
  post_id:  string;
  umap_x:   number;
  umap_y:   number;
  topic_id: number;
  score:    number;
}

// ── Scale UMAP coords → pixel space ──────────────────────────────────────────
function scalePoints(
  raw: RawPoint[],
  canvasW: number,
  canvasH: number,
  padding = 80,
): MapPoint[] {
  if (!raw.length) return [];

  const xs = raw.map((p) => p.umap_x).sort((a, b) => a - b);
  const ys = raw.map((p) => p.umap_y).sort((a, b) => a - b);
  const p2 = Math.floor(raw.length * 0.02);
  const p98 = Math.floor(raw.length * 0.98);
  const minX = xs[p2], maxX = xs[p98];
  const minY = ys[p2], maxY = ys[p98];
  const scale = Math.min(
    (canvasW - padding * 2) / (maxX - minX || 1),
    (canvasH - padding * 2) / (maxY - minY || 1),
  );
  const offX = (canvasW - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = (canvasH - (maxY - minY) * scale) / 2 - minY * scale;

  return raw.map((p) => ({
    x:       Math.max(padding / 2, Math.min(canvasW - padding / 2, p.umap_x * scale + offX)),
    y:       Math.max(padding / 2, Math.min(canvasH - padding / 2, p.umap_y * scale + offY)),
    topicId: p.topic_id,
    score:   p.score,
    postId:  p.post_id,
  }));
}

// ── Main fetch ────────────────────────────────────────────────────────────────
let _cache: MapData | null = null;

export async function fetchMapData(
  canvasW: number,
  canvasH: number,
): Promise<MapData> {
  // Return cached data if canvas size hasn't changed significantly
  if (_cache) return _cache;

  // 1. Fetch cluster metadata
  const clustersRes = await fetch("/api/clusters");
  if (!clustersRes.ok) throw new Error("Failed to fetch clusters");
  const { topics, meta }: { topics: RawCluster[]; meta: MapData["meta"] } =
    await clustersRes.json();

  // 2. Fetch UMAP point data
  const umapRes = await fetch("/api/umap");
  if (!umapRes.ok) throw new Error("Failed to fetch UMAP data");
  const rawPoints: RawPoint[] = await umapRes.json();

  // 3. Scale to canvas
  const points = scalePoints(rawPoints, canvasW, canvasH);

  // 4. Map RawCluster → TopicCluster (normalize field names)
  const clusters: TopicCluster[] = topics.map((t) => ({
    id:         t.id,
    name:       t.name,
    top_words:  t.top_words,
    count:      t.count,
    color:      t.color,
    centroid_x: t.centroid_x,
    centroid_y: t.centroid_y,
  }));

  _cache = { points, clusters, meta };
  return _cache;
}

// Clear cache (called when date range filter changes)
export function clearMapCache() {
  _cache = null;
}