import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";

export const dynamic = "force-dynamic";

type LifecycleCluster = {
  topic_id: number;
  avg_sentiment: number;
  avg_toxicity: number;
  phases: Array<{
    phase: string;
    post_count: number;
    date_start: string;
    date_end: string;
    avg_sentiment: number;
    avg_toxicity: number;
  }>;
  monthly?: Array<{
    month: string;
    post_count: number;
    avg_sentiment: number;
    avg_toxicity: number;
    max_toxicity?: number;
  }>;
  most_toxic_post?: Record<string, unknown>;
  most_viral_post?: Record<string, unknown>;
};

const TOPIC_NAMES: Record<number, string> = {
  0: "general chatter",
  1: "anarchist / socialist",
  2: "electoral politics",
  3: "Musk / DOGE",
  4: "Ukraine / Russia",
  5: "immigration / ICE",
  6: "tariffs / trade policy",
  7: "federal workers / courts",
};

const TOPIC_COLORS: Record<number, string> = {
  0: "#1D9E75",
  1: "#7F77DD",
  2: "#BA7517",
  3: "#D85A30",
  4: "#888780",
  5: "#D4537E",
  6: "#378ADD",
  7: "#639922",
};

export async function GET() {
  const fp = path.join(process.cwd(), "public", "data", "lifecycle.json");
  if (fs.existsSync(fp)) {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as {
      lifecycle?: LifecycleCluster[];
      corpus_stats?: Record<string, unknown>;
    };

    const enriched = (data.lifecycle ?? []).map((c) => ({
      ...c,
      name: TOPIC_NAMES[c.topic_id] ?? `topic ${c.topic_id}`,
      color: TOPIC_COLORS[c.topic_id] ?? "#888780",
    }));

    return NextResponse.json({
      ...data,
      lifecycle: enriched,
    });
  }

  if (!allowSyntheticData()) {
    return missingDataResponse("/api/lifecycle", ["public/data/lifecycle.json"]);
  }

  return NextResponse.json(buildSynthetic());
}

function buildSynthetic() {
  const clusters = [
    {
      topic_id: 3,
      name: "Musk / DOGE",
      color: "#D85A30",
      avg_sentiment: -0.44,
      avg_toxicity: 0.62,
      phases: [
        { phase: "Emergence", post_count: 47, date_start: "2024-07", date_end: "2024-08", avg_sentiment: 0.12, avg_toxicity: 0.18 },
        { phase: "Growth", post_count: 124, date_start: "2024-09", date_end: "2024-10", avg_sentiment: -0.08, avg_toxicity: 0.41 },
        { phase: "Peak", post_count: 281, date_start: "2024-11", date_end: "2024-12", avg_sentiment: -0.44, avg_toxicity: 0.68 },
        { phase: "Saturation", post_count: 57, date_start: "2025-01", date_end: "2025-02", avg_sentiment: -0.39, avg_toxicity: 0.55 },
      ],
      monthly: [
        { month: "2024-07", post_count: 23, avg_sentiment: 0.08, avg_toxicity: 0.14, max_toxicity: 0.37 },
        { month: "2024-08", post_count: 24, avg_sentiment: 0.15, avg_toxicity: 0.22, max_toxicity: 0.44 },
        { month: "2024-09", post_count: 55, avg_sentiment: -0.04, avg_toxicity: 0.36, max_toxicity: 0.63 },
        { month: "2024-10", post_count: 69, avg_sentiment: -0.1, avg_toxicity: 0.45, max_toxicity: 0.72 },
        { month: "2024-11", post_count: 140, avg_sentiment: -0.41, avg_toxicity: 0.67, max_toxicity: 0.86 },
        { month: "2024-12", post_count: 141, avg_sentiment: -0.47, avg_toxicity: 0.69, max_toxicity: 0.89 },
        { month: "2025-01", post_count: 33, avg_sentiment: -0.35, avg_toxicity: 0.5, max_toxicity: 0.73 },
        { month: "2025-02", post_count: 24, avg_sentiment: -0.43, avg_toxicity: 0.6, max_toxicity: 0.81 },
      ],
      most_toxic_post: {
        text: "DOGE is dismantling every safety net this country built. Real people will die from this.",
        author: "u/account1",
        subreddit: "politics",
        score: 847,
        date: "2024-11-14",
        toxicity: 0.81,
        sentiment: -0.89,
      },
      most_viral_post: {
        text: "Trump Fires Hundreds of Staff Overseeing Nuclear Weapons: Report",
        author: "ClydeF",
        subreddit: "politics",
        score: 49005,
        date: "2025-02-04",
        toxicity: 0.21,
        sentiment: -0.31,
      },
    },
    {
      topic_id: 5,
      name: "immigration / ICE",
      color: "#D4537E",
      avg_sentiment: -0.51,
      avg_toxicity: 0.71,
      phases: [
        { phase: "Emergence", post_count: 22, date_start: "2024-07", date_end: "2024-08", avg_sentiment: -0.12, avg_toxicity: 0.28 },
        { phase: "Growth", post_count: 68, date_start: "2024-09", date_end: "2024-10", avg_sentiment: -0.29, avg_toxicity: 0.52 },
        { phase: "Peak", post_count: 142, date_start: "2024-11", date_end: "2024-12", avg_sentiment: -0.61, avg_toxicity: 0.78 },
        { phase: "Saturation", post_count: 62, date_start: "2025-01", date_end: "2025-02", avg_sentiment: -0.58, avg_toxicity: 0.71 },
      ],
      monthly: [
        { month: "2024-07", post_count: 11, avg_sentiment: -0.11, avg_toxicity: 0.21, max_toxicity: 0.41 },
        { month: "2024-08", post_count: 11, avg_sentiment: -0.13, avg_toxicity: 0.35, max_toxicity: 0.56 },
        { month: "2024-09", post_count: 30, avg_sentiment: -0.24, avg_toxicity: 0.47, max_toxicity: 0.68 },
        { month: "2024-10", post_count: 38, avg_sentiment: -0.34, avg_toxicity: 0.56, max_toxicity: 0.79 },
        { month: "2024-11", post_count: 74, avg_sentiment: -0.59, avg_toxicity: 0.74, max_toxicity: 0.9 },
        { month: "2024-12", post_count: 68, avg_sentiment: -0.63, avg_toxicity: 0.81, max_toxicity: 0.93 },
        { month: "2025-01", post_count: 34, avg_sentiment: -0.56, avg_toxicity: 0.69, max_toxicity: 0.87 },
        { month: "2025-02", post_count: 28, avg_sentiment: -0.6, avg_toxicity: 0.73, max_toxicity: 0.89 },
      ],
      most_toxic_post: {
        text: "ICE is terrorizing communities. These are not criminals. They are our neighbors.",
        author: "u/account2",
        subreddit: "politics",
        score: 2341,
        date: "2024-12-08",
        toxicity: 0.74,
        sentiment: -0.91,
      },
      most_viral_post: {
        text: "ICE agents arrested a man who had lived legally in the US for 22 years.",
        author: "u/account3",
        subreddit: "politics",
        score: 28432,
        date: "2025-01-22",
        toxicity: 0.38,
        sentiment: -0.67,
      },
    },
  ];

  return {
    lifecycle: clusters,
    corpus_stats: {
      avg_sentiment: -0.31,
      avg_toxicity: 0.48,
      high_toxicity_count: 342,
      rage_amplification: 2.4,
      most_toxic_cluster: 5,
    },
  };
}
