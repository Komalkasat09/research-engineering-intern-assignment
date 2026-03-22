/**
 * GET /api/umap?topic_id=0&limit=50000
 *
 * Returns per-post UMAP 2D coordinates.
 * Reads public/data/umap_points.json if it exists (exported by pipeline),
 * otherwise generates synthetic data so the map renders without running Python.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";

export const dynamic = "force-dynamic";

const MAX_POINTS = 60_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicFilter = searchParams.get("topic_id");
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? String(MAX_POINTS), 10),
    MAX_POINTS,
  );

  const jsonPath = path.join(process.cwd(), "public", "data", "umap_points.json");
  if (fs.existsSync(jsonPath)) {
    let data: unknown[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    if (topicFilter !== null) {
      const id = parseInt(topicFilter, 10);
      data = (data as { topic_id: number }[]).filter((d) => d.topic_id === id);
    }
    return NextResponse.json(data.slice(0, limit));
  }

  if (!allowSyntheticData()) {
    return missingDataResponse("/api/umap", ["public/data/umap_points.json"]);
  }

  return NextResponse.json(generateSyntheticPoints(limit, topicFilter));
}

interface SyntheticCluster {
  id: number; cx: number; cy: number; n: number; sigma: number;
}

const CLUSTERS: SyntheticCluster[] = [
  { id: 0, cx: -3.2, cy:  1.8, n: 8000,  sigma: 0.9 },
  { id: 1, cx:  2.1, cy: -0.6, n: 6500,  sigma: 0.8 },
  { id: 2, cx:  0.4, cy:  3.2, n: 5800,  sigma: 0.7 },
  { id: 3, cx: -1.8, cy: -2.9, n: 4000,  sigma: 0.7 },
  { id: 4, cx:  3.7, cy:  2.1, n: 2900,  sigma: 0.6 },
  { id: 5, cx: -0.9, cy: -4.1, n: 2500,  sigma: 0.6 },
  { id: 6, cx:  4.8, cy: -1.3, n: 4700,  sigma: 0.75 },
  { id: 7, cx:  1.2, cy:  4.6, n: 3600,  sigma: 0.65 },
  { id: 8, cx: -5.1, cy:  0.3, n: 1900,  sigma: 0.55 },
  { id: 9, cx: -2.4, cy:  3.9, n: 2700,  sigma: 0.6  },
  { id:-1, cx:  0.0, cy:  0.0, n: 3000,  sigma: 3.5  },
];

function randn(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateSyntheticPoints(limit: number, topicFilter: string | null) {
  const points: object[] = [];
  let idx = 0;

  const clusters = topicFilter !== null
    ? CLUSTERS.filter((c) => c.id === parseInt(topicFilter, 10))
    : CLUSTERS;

  const totalN = clusters.reduce((s, c) => s + c.n, 0);
  const scale  = totalN > limit ? limit / totalN : 1;

  for (const cluster of clusters) {
    const n = Math.round(cluster.n * scale);
    for (let i = 0; i < n; i++) {
      points.push({
        post_id:  `post_${idx++}`,
        umap_x:   parseFloat((cluster.cx + randn() * cluster.sigma).toFixed(3)),
        umap_y:   parseFloat((cluster.cy + randn() * cluster.sigma).toFixed(3)),
        topic_id: cluster.id,
        score:    Math.max(0, Math.round(Math.exp(Math.random() * 5))),
      });
    }
  }

  // Shuffle for natural render order
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }

  return points;
}