/**
 * GET /api/graph?topic_id=0&limit=500
 * Returns D3-ready node/link data for the force-directed spread graph.
 * Reads from public/data/graph.json or generates synthetic demo data.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topic_id");
  const limit   = parseInt(searchParams.get("limit") ?? "400", 10);

  try {
    const filePath = path.join(process.cwd(), "public", "data", "graph.json");

    if (fs.existsSync(filePath)) {
      const { nodes, links } = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return NextResponse.json({
        nodes: nodes.slice(0, limit),
        links: links.slice(0, limit * 3),
      });
    }

    if (!allowSyntheticData()) {
      return missingDataResponse("/api/graph", ["public/data/graph.json"]);
    }

    return NextResponse.json(getDemoGraph(topicId ? parseInt(topicId) : null, limit));
  } catch (err) {
    console.error("[/api/graph]", err);
    return NextResponse.json({ error: "Failed to load graph" }, { status: 500 });
  }
}

function getDemoGraph(topicId: number | null, limit: number) {
  const subreddits = [
    "r/collapse","r/environment","r/ClimateChange","r/climateskeptics",
    "r/ExtinctionRebellion","r/GlobalWarming","r/climateactionplan",
  ];
  const colors: Record<number, string> = {
    0: "#1D9E75", 1: "#7F77DD", 2: "#BA7517",
    3: "#D85A30", 4: "#888780", 5: "#D4537E",
  };

  const nodes = [];
  const links = [];
  const count = Math.min(limit, 200);

  // Subreddit nodes
  for (let i = 0; i < subreddits.length; i++) {
    nodes.push({
      id:         subreddits[i],
      label:      subreddits[i],
      type:       "subreddit",
      weight:     0.02 + Math.random() * 0.015,
      topic_id:   i % 6,
      post_count: Math.round(500 + Math.random() * 5000),
    });
  }

  // Account nodes
  for (let i = 0; i < count - subreddits.length; i++) {
    const tid = topicId ?? (i % 6);
    nodes.push({
      id:         `u/account_${i}`,
      label:      `u/account_${i}`,
      type:       "account",
      weight:     0.001 + Math.random() * 0.008,
      topic_id:   tid,
      post_count: Math.round(1 + Math.random() * 200),
    });
  }

  // Links — each account connects to 1–3 subreddits
  for (let i = subreddits.length; i < nodes.length; i++) {
    const numLinks = 1 + Math.floor(Math.random() * 2);
    for (let l = 0; l < numLinks; l++) {
      const target = subreddits[Math.floor(Math.random() * subreddits.length)];
      links.push({
        source: nodes[i].id,
        target,
        weight: 1 + Math.floor(Math.random() * 10),
        type:   "co_post",
      });
    }
  }

  return { nodes, links };
}