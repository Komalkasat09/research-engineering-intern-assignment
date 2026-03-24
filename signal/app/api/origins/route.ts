import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { TOPIC_COLORS } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface MetaPost {
  post_id?: string;
  author?: string;
  subreddit?: string;
  text?: string;
  created_utc?: number;
  score?: number;
  topic_id?: number;
}

interface OriginPost {
  author: string;
  subreddit: string;
  text: string;
  date: string;
  score: number;
  created_utc: number;
}

interface SpreadPoint {
  subreddit: string;
  days_after: number;
}

interface OriginCluster {
  topic_id: number;
  name: string;
  color: string;
  post_count: number;
  first_post: OriginPost;
  origin_subreddit: string;
  days_to_spread: number;
  spread_to: string[];
  spread: SpreadPoint[];
  spread_detail: SpreadPoint[];
  largest_subreddit: string;
  time_to_mainstream_days: number;
  mainstream_tier: "instant" | "quick" | "gradual" | "niche";
  top_post: OriginPost;
  earliest_posts: OriginPost[];
  confidence_score?: number;
  confidence_label?: "high" | "medium" | "low";
}

function mainstreamTier(days: number): "instant" | "quick" | "gradual" | "niche" {
  if (days <= 2) return "instant";
  if (days <= 7) return "quick";
  if (days <= 30) return "gradual";
  return "niche";
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 280);
}

function toDate(ts: number | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "unknown";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function toOriginPost(p: MetaPost): OriginPost {
  return {
    author: p.author ?? "u/unknown",
    subreddit: p.subreddit ?? "r/unknown",
    text: clampText(p.text),
    date: toDate(p.created_utc),
    score: p.score ?? 0,
    created_utc: p.created_utc ?? 0,
  };
}

function loadTopicMeta(): Map<number, { name: string; color: string }> {
  const filePath = path.join(process.cwd(), "public", "data", "topics.json");
  const map = new Map<number, { name: string; color: string }>();

  if (!fs.existsSync(filePath)) return map;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      topics?: Array<{ id: number; name: string; color?: string }>;
    };

    for (const topic of parsed.topics ?? []) {
      map.set(topic.id, {
        name: topic.name,
        color: topic.color ?? TOPIC_COLORS[topic.id] ?? "#3A4148",
      });
    }
  } catch {
    return map;
  }

  return map;
}

function buildClustersFromMeta(posts: MetaPost[]): OriginCluster[] {
  const topicMeta = loadTopicMeta();
  const byTopic = new Map<number, MetaPost[]>();
  const topicCounts: Record<number, number> = {};

  for (const p of posts) {
    const tid = Number(p.topic_id);
    if (!Number.isFinite(tid) || tid < 0) continue;
    topicCounts[tid] = (topicCounts[tid] ?? 0) + 1;
    if (!p.created_utc || !p.subreddit) continue;

    if (!byTopic.has(tid)) byTopic.set(tid, []);
    byTopic.get(tid)?.push(p);
  }

  const clusters: OriginCluster[] = [];

  for (const [topicId, clusterPosts] of [...byTopic.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...clusterPosts].sort((a, b) => (a.created_utc ?? 0) - (b.created_utc ?? 0));
    if (!sorted.length) continue;

    const first = sorted[0];
    const firstPost = toOriginPost(first);

    // First post per subreddit in this cluster.
    const firstBySub = new Map<string, MetaPost>();
    for (const p of sorted) {
      const sub = p.subreddit ?? "r/unknown";
      if (!firstBySub.has(sub)) firstBySub.set(sub, p);
    }

    const spreadOrder = [...firstBySub.entries()].sort(
      (a, b) => (a[1].created_utc ?? 0) - (b[1].created_utc ?? 0)
    );

    const subredditCounts = new Map<string, number>();
    for (const post of sorted) {
      const sub = post.subreddit ?? "r/unknown";
      subredditCounts.set(sub, (subredditCounts.get(sub) ?? 0) + 1);
    }

    const originSubreddit = spreadOrder[0]?.[0] ?? firstPost.subreddit;
    const originTs = spreadOrder[0]?.[1].created_utc ?? first.created_utc ?? 0;
    const largestSubreddit = [...subredditCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? originSubreddit;
    const largestSubFirstTs = firstBySub.get(largestSubreddit)?.created_utc ?? originTs;
    const timeToMainstreamDays = Math.max(0, Math.floor((largestSubFirstTs - originTs) / 86400));

    const spreadDetail: SpreadPoint[] = spreadOrder
      .slice(1)
      .map(([sub, post]) => {
        const days = Math.max(0, Math.floor(((post.created_utc ?? originTs) - originTs) / 86400));
        return { subreddit: sub, days_after: days };
      })
      .filter((s) => s.subreddit !== originSubreddit);

    const daysToSpread = spreadDetail.length ? spreadDetail[0].days_after : 0;
    const spreadTo = spreadDetail.map((s) => s.subreddit);
    const postSignal = clamp01(Math.log10(Math.max(topicCounts[topicId] ?? 1, 1)) / 3);
    const spreadSignal = clamp01(spreadTo.length / 8);
    const speedSignal = spreadDetail.length ? clamp01(1 - ((daysToSpread ?? 0) / 21)) : 0.2;
    const confidenceScore = clamp01((postSignal * 0.35) + (spreadSignal * 0.35) + (speedSignal * 0.3));

    const top = [...clusterPosts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

    const topic = topicMeta.get(topicId);
    clusters.push({
      topic_id: topicId,
      name: topic?.name ?? `topic ${topicId}`,
      color: topic?.color ?? TOPIC_COLORS[topicId] ?? "#3A4148",
      post_count: topicCounts[topicId] ?? 0,
      first_post: firstPost,
      origin_subreddit: originSubreddit,
      days_to_spread: daysToSpread,
      spread_to: spreadTo,
      spread: spreadDetail,
      spread_detail: spreadDetail,
      largest_subreddit: largestSubreddit,
      time_to_mainstream_days: timeToMainstreamDays,
      mainstream_tier: mainstreamTier(timeToMainstreamDays),
      top_post: toOriginPost(top),
      earliest_posts: sorted.slice(0, 5).map(toOriginPost),
      confidence_score: Number(confidenceScore.toFixed(3)),
      confidence_label: confidenceLabel(confidenceScore),
    });
  }

  return clusters;
}

function getSyntheticClusters(): OriginCluster[] {
  return [
    {
      topic_id: 3,
      name: "Musk / DOGE",
      color: "#D85A30",
      post_count: 509,
      first_post: {
        author: "u/fedwatchdog",
        subreddit: "r/politics",
        text: "DOGE has direct access to payment rails and no one can explain the audit boundary.",
        date: "2024-07-24",
        score: 48,
        created_utc: 1721779200,
      },
      origin_subreddit: "r/politics",
      days_to_spread: 2,
      spread_to: ["r/democrats", "r/neoliberal", "r/Conservative"],
      spread: [
        { subreddit: "r/democrats", days_after: 2 },
        { subreddit: "r/neoliberal", days_after: 4 },
        { subreddit: "r/Conservative", days_after: 7 },
      ],
      spread_detail: [
        { subreddit: "r/democrats", days_after: 2 },
        { subreddit: "r/neoliberal", days_after: 4 },
        { subreddit: "r/Conservative", days_after: 7 },
      ],
      largest_subreddit: "r/democrats",
      time_to_mainstream_days: 2,
      mainstream_tier: "instant",
      top_post: {
        author: "u/appropriationsnerd",
        subreddit: "r/democrats",
        text: "If DOGE can pause federal disbursements, congressional power of the purse is effectively bypassed.",
        date: "2024-08-02",
        score: 932,
        created_utc: 1722556800,
      },
      earliest_posts: [],
    },
    {
      topic_id: 5,
      name: "immigration / ICE",
      color: "#D4537E",
      post_count: 294,
      first_post: {
        author: "u/borderbriefing",
        subreddit: "r/Conservative",
        text: "ICE interior enforcement is finally being treated as a credibility test for federal authority.",
        date: "2024-08-01",
        score: 76,
        created_utc: 1722470400,
      },
      origin_subreddit: "r/Conservative",
      days_to_spread: 1,
      spread_to: ["r/politics", "r/Anarchism", "r/democrats"],
      spread: [
        { subreddit: "r/politics", days_after: 1 },
        { subreddit: "r/Anarchism", days_after: 3 },
        { subreddit: "r/democrats", days_after: 5 },
      ],
      spread_detail: [
        { subreddit: "r/politics", days_after: 1 },
        { subreddit: "r/Anarchism", days_after: 3 },
        { subreddit: "r/democrats", days_after: 5 },
      ],
      largest_subreddit: "r/politics",
      time_to_mainstream_days: 1,
      mainstream_tier: "instant",
      top_post: {
        author: "u/civilrightsdesk",
        subreddit: "r/politics",
        text: "Mass removals of legal residents would convert administrative discretion into constitutional crisis.",
        date: "2024-08-05",
        score: 801,
        created_utc: 1722816000,
      },
      earliest_posts: [],
    },
    {
      topic_id: 1,
      name: "anarchist / socialist",
      color: "#7F77DD",
      post_count: 716,
      first_post: {
        author: "u/communalmutualaid",
        subreddit: "r/Anarchism",
        text: "Federal cuts are framed as efficiency, but this is still coercive extraction from workers downward.",
        date: "2024-07-28",
        score: 65,
        created_utc: 1722124800,
      },
      origin_subreddit: "r/Anarchism",
      days_to_spread: 4,
      spread_to: ["r/politics", "r/neoliberal"],
      spread: [
        { subreddit: "r/politics", days_after: 4 },
        { subreddit: "r/neoliberal", days_after: 9 },
      ],
      spread_detail: [
        { subreddit: "r/politics", days_after: 4 },
        { subreddit: "r/neoliberal", days_after: 9 },
      ],
      largest_subreddit: "r/politics",
      time_to_mainstream_days: 4,
      mainstream_tier: "quick",
      top_post: {
        author: "u/agencyandpower",
        subreddit: "r/Anarchism",
        text: "Every 'temporary emergency authority' eventually normalizes a permanent governance model.",
        date: "2024-08-08",
        score: 516,
        created_utc: 1723075200,
      },
      earliest_posts: [],
    },
  ].map((c): OriginCluster => ({
    ...c,
    mainstream_tier: c.mainstream_tier as "instant" | "quick" | "gradual" | "niche",
    earliest_posts: c.earliest_posts.length ? c.earliest_posts : [c.first_post, c.top_post],
  }));
}

export async function GET() {
  const faissPath = path.join(process.cwd(), "data", "faiss_meta.json");

  if (!fs.existsSync(faissPath)) {
    return NextResponse.json({ clusters: getSyntheticClusters() });
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(faissPath, "utf-8")) as { posts?: MetaPost[] };
    const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
    const clusters = buildClustersFromMeta(posts);

    if (!clusters.length) {
      return NextResponse.json({ clusters: getSyntheticClusters() });
    }

    return NextResponse.json({ clusters });
  } catch (err) {
    console.error("[/api/origins]", err);
    return NextResponse.json({ clusters: getSyntheticClusters() });
  }
}
