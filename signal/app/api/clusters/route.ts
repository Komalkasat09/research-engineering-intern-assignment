/**
 * GET /api/clusters
 * Returns precomputed BERTopic cluster metadata from the static JSON file.
 * In production this would query DuckDB; for the hosted demo it reads
 * the precomputed output committed to public/data/.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";

export async function GET(req: NextRequest) {
  try {
    const k = Number(req.nextUrl.searchParams.get("k") ?? "0");
    const filePath = path.join(process.cwd(), "public", "data", "topics.json");

    // If the precomputed file exists, serve it directly
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data)) {
        const topics = data
          .filter((t) => Number(t?.id) !== -1)
          .sort(
            (a, b) =>
              Number(b?.post_count ?? b?.count ?? 0) -
              Number(a?.post_count ?? a?.count ?? 0)
          );

        const sliced = k >= 2 ? topics.slice(0, k) : topics;
        return NextResponse.json(sliced);
      }

      const topics = (data?.topics ?? [])
        .filter((t: { id?: number }) => Number(t?.id) !== -1)
        .sort(
          (
            a: { post_count?: number; count?: number },
            b: { post_count?: number; count?: number }
          ) =>
            Number(b?.post_count ?? b?.count ?? 0) -
            Number(a?.post_count ?? a?.count ?? 0)
        );

      const sliced = k >= 2 ? topics.slice(0, k) : topics;
      return NextResponse.json({ ...data, topics: sliced });
    }

    if (!allowSyntheticData()) {
      return missingDataResponse("/api/clusters", ["public/data/topics.json"]);
    }

    // Demo-only fallback for local development.
    return NextResponse.json(getDemoTopics());
  } catch (err) {
    console.error("[/api/clusters]", err);
    return NextResponse.json({ error: "Failed to load clusters" }, { status: 500 });
  }
}

// ── Demo data (real BERTopic output format) ──────────────────────────────────
function getDemoTopics() {
  return {
    topics: [
      {
        id: 0,
        name: "electoral politics",
        top_words: ["election","ballot","turnout","campaign","vote","district","primary","count"],
        count: 124318,
        color: "#1D9E75",
        centroid_x: -3.2,
        centroid_y: 1.8,
      },
      {
        id: 1,
        name: "economic policy",
        top_words: ["inflation","jobs","budget","tax","wages","spending","market","recession"],
        count: 98042,
        color: "#7F77DD",
        centroid_x: 2.1,
        centroid_y: -0.6,
      },
      {
        id: 2,
        name: "social issues",
        top_words: ["education","healthcare","abortion","housing","inequality","rights","safety","access"],
        count: 87561,
        color: "#BA7517",
        centroid_x: 0.4,
        centroid_y: 3.2,
      },
      {
        id: 3,
        name: "media criticism",
        top_words: ["headline","coverage","bias","narrative","outlet","framing","misinfo","spin"],
        count: 61204,
        color: "#D85A30",
        centroid_x: -1.8,
        centroid_y: -2.9,
      },
      {
        id: 4,
        name: "foreign policy",
        top_words: ["nato","ukraine","china","border","aid","security","allies","sanctions"],
        count: 44832,
        color: "#888780",
        centroid_x: 3.7,
        centroid_y: 2.1,
      },
      {
        id: 5,
        name: "civil rights",
        top_words: ["voting","justice","liberty","speech","equal","court","civil","protection"],
        count: 38210,
        color: "#D4537E",
        centroid_x: -0.9,
        centroid_y: -4.1,
      },
      {
        id: 6,
        name: "political figures",
        top_words: ["biden","trump","governor","senator","candidate","approval","speech","debate"],
        count: 72104,
        color: "#378ADD",
        centroid_x: 4.8,
        centroid_y: -1.3,
      },
      {
        id: 7,
        name: "legislative debate",
        top_words: ["bill","amendment","committee","filibuster","house","senate","vote","clause"],
        count: 55630,
        color: "#639922",
        centroid_x: 1.2,
        centroid_y: 4.6,
      },
      {
        id: 8,
        name: "partisan framing",
        top_words: ["left","right","elite","base","identity","polarization","tribal","culture"],
        count: 29841,
        color: "#E24B4A",
        centroid_x: -5.1,
        centroid_y: 0.3,
      },
      {
        id: 9,
        name: "grassroots organizing",
        top_words: ["volunteer","door","phonebank","canvass","chapter","organize","coalition","turnout"],
        count: 41203,
        color: "#5DCAA5",
        centroid_x: -2.4,
        centroid_y: 3.9,
      },
    ],
    meta: {
      total_posts:     847203,
      date_start:      "2019-01-01",
      date_end:        "2023-12-31",
      subreddits:      284,
      unique_authors:  142819,
      topic_count:     10,
    },
  };
}