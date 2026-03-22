/**
 * GET /api/velocity?topic_id=0
 * Returns weekly velocity (cosine centroid drift) for one or all topics.
 * Reads from precomputed parquet → JSON; falls back to synthetic demo data.
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

  try {
    const filePath = path.join(
      process.cwd(), "public", "data", "velocity.json"
    );

    let data: unknown[];
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } else {
      if (!allowSyntheticData()) {
        return missingDataResponse("/api/velocity", ["public/data/velocity.json"]);
      }
      data = getDemoVelocity();
    }

    // Filter if topic_id requested
    if (topicId !== null) {
      const id = parseInt(topicId, 10);
      data = (data as { topic_id: number }[]).filter((d) => d.topic_id === id);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/velocity]", err);
    return NextResponse.json({ error: "Failed to load velocity" }, { status: 500 });
  }
}

// Synthetic weekly velocity — realistic shape with COP/IPCC spikes
function getDemoVelocity() {
  const topics = [0, 1, 2, 3, 6]; // top 5 by volume
  const baseDate = new Date("2019-01-07");
  const weeks = 260; // 5 years
  const result = [];

  // Known event weeks (approximate) — velocity spikes here
  const spikes: Record<number, number> = {
    36:  0.38, // Sep 2019 — UN Climate Summit
    118: 0.41, // Nov 2021 — COP26
    163: 0.45, // Feb 2022 — IPCC AR6 WG2
    201: 0.39, // Nov 2022 — COP27
    223: 0.29, // Apr 2023 — IPCC synthesis
    254: 0.43, // Nov 2023 — COP28
  };

  for (const topicId of topics) {
    let prev = 0.05 + Math.random() * 0.05;
    for (let w = 0; w < weeks; w++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + w * 7);
      const isoWeek = `${d.getFullYear()}-W${String(Math.ceil(w % 52) + 1).padStart(2, "0")}`;

      // Natural drift + event spikes
      const spike = spikes[w] ?? 0;
      const noise = (Math.random() - 0.5) * 0.04;
      const v = Math.max(0, Math.min(1, prev * 0.85 + 0.02 + spike * 0.6 + noise));
      prev = v;

      result.push({
        week:       isoWeek,
        topic_id:   topicId,
        velocity:   parseFloat(v.toFixed(4)),
        post_count: Math.round(200 + Math.random() * 1800 + spike * 3000),
      });
    }
  }
  return result;
}