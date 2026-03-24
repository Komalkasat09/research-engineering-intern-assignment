import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface GraphNode {
  id?: string;
  label?: string;
  type?: string;
  weight?: number;
  topic_id?: number;
  post_count?: number;
}

interface GraphData {
  nodes?: GraphNode[];
}

export async function GET() {
  const artifact = path.join(process.cwd(), "public", "data", "counterfactual.json");
  if (fs.existsSync(artifact)) {
    return NextResponse.json(JSON.parse(fs.readFileSync(artifact, "utf-8")));
  }

  const graphPath = path.join(process.cwd(), "public", "data", "graph.json");
  if (!fs.existsSync(graphPath)) return NextResponse.json({ topics: [] });

  const graph = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as GraphData;
  const nodes = (graph.nodes ?? []).filter((n) => n.type === "account");

  const byTopic = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const tid = Number(n.topic_id);
    if (!Number.isFinite(tid) || tid < 0) continue;
    if (!byTopic.has(tid)) byTopic.set(tid, []);
    byTopic.get(tid)?.push(n);
  }

  const topics = [...byTopic.entries()].map(([topic_id, topicNodes]) => {
    const sorted = [...topicNodes].sort((a, b) => Number(b.weight ?? 0) - Number(a.weight ?? 0));
    const top = sorted[0];
    const second = sorted[1];
    const baselinePeak = Number(top?.weight ?? 0);
    const peakIfRemoved = Number(second?.weight ?? 0);
    const impact = Math.max(0, baselinePeak - peakIfRemoved);

    return {
      topic_id,
      top_account: top?.id ?? "unknown",
      baseline_peak: Number(baselinePeak.toFixed(4)),
      peak_if_removed: Number(peakIfRemoved.toFixed(4)),
      impact_score: Number(impact.toFixed(4)),
      impact_pct: Number((baselinePeak > 0 ? (impact / baselinePeak) * 100 : 0).toFixed(1)),
    };
  });

  return NextResponse.json({ topics });
}
