import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { TOPIC_COLORS } from "@/lib/constants";
import { cleanTopicName } from "@/lib/cleanTopicName";

export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;

interface VelocityPoint {
  week?: string;
  topic_id?: number;
  velocity?: number;
  post_count?: number;
}

interface OriginPost {
  text?: string;
  author?: string;
  subreddit?: string;
  score?: number;
  date?: string;
  created_utc?: number;
}

interface OriginCluster {
  topic_id?: number;
  name?: string;
  color?: string;
  post_count?: number;
  origin_subreddit?: string;
  spread_to?: string[];
  top_post?: OriginPost;
}

interface TopicDef {
  id?: number;
  name?: string;
  color?: string;
}

interface MetaPost {
  post_id?: string;
  text?: string;
  author?: string;
  subreddit?: string;
  topic_id?: number;
  created_utc?: number;
  score?: number;
}

interface CoordData {
  accounts?: string[];
  months?: string[];
  cells?: Array<{ account?: string; month?: string; count?: number }>;
}

interface TopNarrative {
  topic_id: number;
  name: string;
  color: string;
  post_count: number;
  velocity_spike: number;
  velocity_change: number;
  top_post: {
    text: string;
    author: string;
    subreddit: string;
    score: number;
    date: string;
  };
  origin_subreddit: string;
  peak_week: string;
  confidence_score: number;
  confidence_label: "high" | "medium" | "low";
  rank_reason: {
    score: number;
    velocity_spike: number;
    spread_count: number;
    post_count: number;
  };
}

interface TrendsResponse {
  top_narratives: TopNarrative[];
  most_amplified_accounts: Array<{
    author: string;
    subreddit: string;
    score: number;
    topic_name: string;
  }>;
  emerging_terms: string[];
  summary_stats: {
    fastest_rising: string;
    most_posts: string;
    mutation_count: number;
    peak_velocity: number;
  };
}

function readJsonFile<T>(segments: string[], fallback: T): T {
  try {
    const filePath = path.join(process.cwd(), ...segments);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function normalizeSubreddit(value: string | undefined): string {
  if (!value) return "r/unknown";
  return value.startsWith("r/") ? value : `r/${value}`;
}

function toDateString(createdUtc: number | undefined): string {
  if (!createdUtc || !Number.isFinite(createdUtc)) return "unknown";
  return new Date(createdUtc * 1000).toISOString().slice(0, 10);
}

function trimPostText(text: string | undefined, maxLen = 200): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function std(values: number[]): number {
  if (!values.length) return 0;
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.72) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function topWords(posts: MetaPost[], n = 50): Set<string> {
  const freq: Record<string, number> = {};
  const stopwords = new Set([
    "the", "a", "an", "is", "it", "in", "of", "to", "and", "or", "but", "not", "that", "this", "was",
    "are", "for", "on", "at", "by", "be", "as", "we", "they", "with", "have", "from", "has", "its",
    "been", "were", "will",
  ]);

  for (const p of posts) {
    const text = (p.text ?? "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    for (const w of text) {
      if (w.length > 4 && !stopwords.has(w)) {
        freq[w] = (freq[w] ?? 0) + 1;
      }
    }
  }

  return new Set(
    Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([w]) => w)
  );
}

export async function GET() {
  const velocity = readJsonFile<VelocityPoint[]>(["public", "data", "velocity.json"], []);
  const origins = readJsonFile<{ clusters?: OriginCluster[] }>(["public", "data", "origins.json"], {});
  const topics = readJsonFile<{ topics?: TopicDef[] }>(["public", "data", "topics.json"], {});
  const coord = readJsonFile<CoordData>(["public", "data", "coord.json"], {});
  const meta = readJsonFile<{ posts?: MetaPost[] }>(["data", "faiss_meta.json"], {});

  const topicNameMap = new Map<number, string>();
  const topicColorMap = new Map<number, string>();

  for (const t of topics.topics ?? []) {
    const topicId = Number(t.id);
    if (!Number.isFinite(topicId)) continue;
    topicNameMap.set(topicId, cleanTopicName(t.name ?? `topic ${topicId}`));
    topicColorMap.set(topicId, t.color ?? TOPIC_COLORS[topicId] ?? "#3A4148");
  }

  const originByTopic = new Map<number, OriginCluster>();
  for (const c of origins.clusters ?? []) {
    const topicId = Number(c.topic_id);
    if (!Number.isFinite(topicId)) continue;
    originByTopic.set(topicId, c);
  }

  const posts = (meta.posts ?? []).filter((p): p is MetaPost => typeof p === "object" && p !== null);
  const postsByTopic = new Map<number, MetaPost[]>();

  for (const p of posts) {
    const topicId = Number(p.topic_id);
    if (!Number.isFinite(topicId)) continue;
    if (!postsByTopic.has(topicId)) postsByTopic.set(topicId, []);
    postsByTopic.get(topicId)?.push(p);
  }

  const velocityByTopic = new Map<number, VelocityPoint[]>();
  for (const row of velocity) {
    const topicId = Number(row.topic_id);
    if (!Number.isFinite(topicId)) continue;
    if (!velocityByTopic.has(topicId)) velocityByTopic.set(topicId, []);
    velocityByTopic.get(topicId)?.push(row);
  }

  const allTopicIds = new Set<number>([
    ...velocityByTopic.keys(),
    ...originByTopic.keys(),
    ...postsByTopic.keys(),
  ]);

  // Filter out topic -1 (noise cluster)
  allTopicIds.delete(-1);

  const topNarratives: TopNarrative[] = [];

  for (const topicId of allTopicIds) {
    const series = (velocityByTopic.get(topicId) ?? [])
      .filter((d) => Number.isFinite(d.velocity))
      .sort((a, b) => String(a.week ?? "").localeCompare(String(b.week ?? "")));

    const firstWindow = series.slice(0, 30).map((d) => Number(d.velocity ?? 0));
    const recentWindowRows = series.slice(-30);
    const recentWindow = recentWindowRows.map((d) => Number(d.velocity ?? 0));

    const earlyAvg = mean(firstWindow);
    const recentAvg = mean(recentWindow);
    const recentMax = recentWindow.length ? Math.max(...recentWindow) : 0;

    const velocityChange = earlyAvg === 0
      ? (recentAvg > 0 ? 100 : 0)
      : ((recentAvg - earlyAvg) / Math.abs(earlyAvg)) * 100;

    const peak = recentWindowRows.reduce<VelocityPoint | null>((best, row) => {
      if (!best) return row;
      return Number(row.velocity ?? 0) > Number(best.velocity ?? 0) ? row : best;
    }, null);

    const origin = originByTopic.get(topicId);
    const topicPosts = postsByTopic.get(topicId) ?? [];
    const topPostFromMeta = [...topicPosts].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))[0];

    const topPost = origin?.top_post ?? {
      text: topPostFromMeta?.text,
      author: topPostFromMeta?.author,
      subreddit: topPostFromMeta?.subreddit,
      score: topPostFromMeta?.score,
      date: toDateString(topPostFromMeta?.created_utc),
      created_utc: topPostFromMeta?.created_utc,
    };

    const postCount = Number(
      origin?.post_count
      ?? topicPosts.length
      ?? series.reduce((sum, row) => sum + Number(row.post_count ?? 0), 0)
    );

    const rawName = origin?.name ?? topicNameMap.get(topicId) ?? `topic ${topicId}`;
    const spreadCount = origin?.spread_to?.length ?? 0;
    const recentStd = std(recentWindow);
    const velocityStability = 1 - clamp01(recentStd / Math.max(recentAvg || 0.01, 0.01));
    const volumeSignal = clamp01(Math.log10(Math.max(postCount, 1)) / 3);
    const spreadSignal = clamp01(spreadCount / 8);
    const confidenceScore = clamp01((velocityStability * 0.45) + (volumeSignal * 0.35) + (spreadSignal * 0.2));

    topNarratives.push({
      topic_id: topicId,
      name: cleanTopicName(rawName),
      color: origin?.color ?? topicColorMap.get(topicId) ?? TOPIC_COLORS[topicId] ?? "#3A4148",
      post_count: Number.isFinite(postCount) ? postCount : 0,
      velocity_spike: Number(recentMax.toFixed(4)),
      velocity_change: Number(velocityChange.toFixed(2)),
      top_post: {
        text: trimPostText(topPost.text),
        author: topPost.author ?? "u/unknown",
        subreddit: normalizeSubreddit(topPost.subreddit),
        score: Number(topPost.score ?? 0),
        date: topPost.date ?? toDateString(topPost.created_utc),
      },
      origin_subreddit: normalizeSubreddit(origin?.origin_subreddit),
      peak_week: peak?.week ?? "unknown",
      confidence_score: Number(confidenceScore.toFixed(3)),
      confidence_label: confidenceLabel(confidenceScore),
      rank_reason: {
        score: Number(topPost.score ?? 0),
        velocity_spike: Number(recentMax.toFixed(4)),
        spread_count: spreadCount,
        post_count: Number.isFinite(postCount) ? postCount : 0,
      },
    });
  }

  // Sort by top post score (viralness) first, then velocity
  topNarratives.sort((a, b) => {
    const scoreA = a.top_post.score ?? 0;
    const scoreB = b.top_post.score ?? 0;
    return scoreB - scoreA;
  });

  const coordAccounts = new Set((coord.accounts ?? []).map((a) => a.toLowerCase()));
  const mostAmplified = [...posts]
    .filter((p) => coordAccounts.size === 0 || coordAccounts.has((p.author ?? "").toLowerCase()))
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));

  const seenAuthors = new Set<string>();
  const mostAmplifiedAccounts = mostAmplified
    .filter((p) => {
      const author = (p.author ?? "u/unknown").toLowerCase();
      if (seenAuthors.has(author)) return false;
      seenAuthors.add(author);
      return true;
    })
    .slice(0, 5)
    .map((p) => {
      const topicId = Number(p.topic_id);
      return {
        author: p.author ?? "u/unknown",
        subreddit: normalizeSubreddit(p.subreddit),
        score: Number(p.score ?? 0),
        topic_name: cleanTopicName(
          topicNameMap.get(topicId) ?? originByTopic.get(topicId)?.name ?? `topic ${topicId}`
        ),
      };
    });

  // Split dataset in half by date.
  const sortedPosts = [...posts].sort((a, b) => Number(a.created_utc ?? 0) - Number(b.created_utc ?? 0));
  const mid = Math.floor(sortedPosts.length / 2);
  const early = sortedPosts.slice(0, mid);
  const recent = sortedPosts.slice(mid);

  const earlyWords = topWords(early);
  const recentWords = topWords(recent, 100);
  const emergingTerms = [...recentWords].filter((w) => !earlyWords.has(w)).slice(0, 8);

  const fastestRising = [...topNarratives].reduce((best, n) => 
    (n.velocity_spike > (best?.velocity_spike ?? 0)) ? n : best
  , topNarratives[0])?.name ?? "—";
  const mostPostsCluster = [...topNarratives].sort((a, b) => b.post_count - a.post_count)[0];
  const mostPosts = mostPostsCluster ? cleanTopicName(mostPostsCluster.name) : "—";
  const mutationCount = topNarratives.filter((n) => n.velocity_spike > 0.3).length;
  const peakVelocity = topNarratives.length ? Math.max(...topNarratives.map((n) => n.velocity_spike)) : 0;

  const payload: TrendsResponse = {
    top_narratives: topNarratives,
    most_amplified_accounts: mostAmplifiedAccounts,
    emerging_terms: emergingTerms,
    summary_stats: {
      fastest_rising: fastestRising,
      most_posts: mostPosts,
      mutation_count: mutationCount,
      peak_velocity: Number(peakVelocity.toFixed(4)),
    },
  };

  return NextResponse.json(payload);
}
