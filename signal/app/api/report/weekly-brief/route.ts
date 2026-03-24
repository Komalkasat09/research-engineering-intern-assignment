import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

function loadJson<T>(fp: string, fallback: T): T {
  if (!fs.existsSync(fp)) return fallback;
  return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
}

export async function GET() {
  const root = path.join(process.cwd(), "public", "data");
  const trends = loadJson<{ top_narratives?: Array<{ name?: string; velocity_spike?: number; top_post?: { score?: number } }> }>(path.join(root, "trends.cache.json"), {});
  const origins = loadJson<{ clusters?: Array<{ name?: string; time_to_mainstream_days?: number }> }>(path.join(root, "origins.json"), {});
  const alerts = loadJson<{ alerts?: Array<{ topic_id?: number; severity?: string; reason?: string; score?: number }> }>(path.join(root, "alerts.json"), {});
  const coord = loadJson<{ top_pairs?: Array<{ account_a?: string; account_b?: string; sync_count?: number }> }>(path.join(root, "coord.json"), {});

  const topNarrative = (trends.top_narratives ?? [])[0];
  const fastestMainstream = [...(origins.clusters ?? [])].sort((a, b) => Number(a.time_to_mainstream_days ?? 999) - Number(b.time_to_mainstream_days ?? 999))[0];
  const topPair = [...(coord.top_pairs ?? [])].sort((a, b) => Number(b.sync_count ?? 0) - Number(a.sync_count ?? 0))[0];

  const brief = {
    generated_at: new Date().toISOString(),
    highlights: {
      top_narrative: topNarrative?.name ?? "—",
      top_narrative_score: Number(topNarrative?.top_post?.score ?? 0),
      fastest_mainstream: fastestMainstream?.name ?? "—",
      time_to_mainstream_days: Number(fastestMainstream?.time_to_mainstream_days ?? 0),
      strongest_coord_pair: topPair ? `${topPair.account_a} ↔ ${topPair.account_b}` : "—",
      strongest_coord_syncs: Number(topPair?.sync_count ?? 0),
    },
    alerts: (alerts.alerts ?? []).slice(0, 8),
    caveats: [
      "Correlation does not imply coordination intent.",
      "Stance labels have known ambiguity on informal social text.",
      "Confidence tiers are heuristic signals, not ground truth.",
    ],
  };

  return NextResponse.json(brief);
}
