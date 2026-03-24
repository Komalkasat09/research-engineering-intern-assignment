import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface VelocityPoint { topic_id?: number; velocity?: number; week?: string }
interface CoordJson {
  top_pairs?: Array<{ sync_count?: number; account_a?: string; account_b?: string }>;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values: number[]): number {
  if (!values.length) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

export async function GET() {
  const artifact = path.join(process.cwd(), "public", "data", "alerts.json");
  if (fs.existsSync(artifact)) {
    return NextResponse.json(JSON.parse(fs.readFileSync(artifact, "utf-8")));
  }

  const velocityPath = path.join(process.cwd(), "public", "data", "velocity.json");
  const coordPath = path.join(process.cwd(), "public", "data", "coord.json");

  if (!fs.existsSync(velocityPath) || !fs.existsSync(coordPath)) {
    return NextResponse.json({ alerts: [] });
  }

  const velocity = JSON.parse(fs.readFileSync(velocityPath, "utf-8")) as VelocityPoint[];
  const coord = JSON.parse(fs.readFileSync(coordPath, "utf-8")) as CoordJson;

  const byTopic = new Map<number, VelocityPoint[]>();
  for (const row of velocity) {
    const tid = Number(row.topic_id);
    if (!Number.isFinite(tid) || tid < 0) continue;
    if (!byTopic.has(tid)) byTopic.set(tid, []);
    byTopic.get(tid)?.push(row);
  }

  const coordSpike = (coord.top_pairs ?? []).reduce((s, p) => s + Number(p.sync_count ?? 0), 0) / Math.max((coord.top_pairs ?? []).length, 1);

  const alerts = [...byTopic.entries()].flatMap(([topic_id, rows]) => {
    const series = rows
      .map((r) => ({ velocity: Number(r.velocity ?? 0), week: r.week ?? "unknown" }))
      .sort((a, b) => a.week.localeCompare(b.week));
    const baseline = series.slice(0, -5).map((x) => x.velocity);
    const recent = series.slice(-5).map((x) => x.velocity);
    const baselineMean = mean(baseline);
    const baselineStd = std(baseline) || 0.001;
    const recentPeak = recent.length ? Math.max(...recent) : 0;
    const z = (recentPeak - baselineMean) / baselineStd;
    const combined = (z * 0.7) + ((coordSpike / 8) * 0.3);

    if (combined < 1.2) return [];
    const severity = combined > 2.5 ? "high" : combined > 1.7 ? "medium" : "low";

    return [{
      topic_id,
      week: series[series.length - 1]?.week ?? "unknown",
      severity,
      score: Number(combined.toFixed(3)),
      velocity_z: Number(z.toFixed(3)),
      coord_spike: Number(coordSpike.toFixed(2)),
      reason: `Velocity anomaly with coordination lift (${severity}).`,
    }];
  });

  return NextResponse.json({ alerts });
}
