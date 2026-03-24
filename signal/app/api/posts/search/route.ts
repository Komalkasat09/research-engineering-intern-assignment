import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { missingDataResponse } from "@/lib/dataMode";

export const dynamic = "force-dynamic";

interface MetaPost {
  post_id?: string;
  text?: string;
  author?: string;
  subreddit?: string;
  topic_id?: number;
  created_utc?: number;
  score?: number;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 2);
}

function scorePost(post: MetaPost, tokens: string[]): { score: number; matched: string[] } {
  const hay = `${post.text ?? ""} ${(post.author ?? "")} ${(post.subreddit ?? "")}`.toLowerCase();
  let relevance = 0;
  const matched: string[] = [];

  for (const t of tokens) {
    if (!hay.includes(t)) continue;
    matched.push(t);
    relevance += 2;
    if ((post.text ?? "").toLowerCase().includes(t)) relevance += 2;
    if ((post.subreddit ?? "").toLowerCase().includes(t)) relevance += 1;
    if ((post.author ?? "").toLowerCase().includes(t)) relevance += 1;
  }

  const amp = Math.log10(Math.max(1, Number(post.score ?? 0) + 1));
  relevance += amp;
  return { score: relevance, matched };
}

function toDate(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return "unknown";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const topicIdRaw = searchParams.get("topic_id");
  const subreddit = String(searchParams.get("subreddit") ?? "").trim().toLowerCase();
  const author = String(searchParams.get("author") ?? "").trim().toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));

  const metaPath = path.join(process.cwd(), "data", "faiss_meta.json");
  if (!fs.existsSync(metaPath)) {
    return missingDataResponse("/api/posts/search", ["data/faiss_meta.json"]);
  }

  const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { posts?: MetaPost[] };
  const allPosts = Array.isArray(parsed.posts) ? parsed.posts : [];

  let baseFiltered = allPosts;
  if (subreddit) baseFiltered = baseFiltered.filter((p) => String(p.subreddit ?? "").toLowerCase() === subreddit);
  if (author) baseFiltered = baseFiltered.filter((p) => String(p.author ?? "").toLowerCase() === author);

  let scopedPosts = baseFiltered;

  if (topicIdRaw !== null && topicIdRaw !== "") {
    const topicId = Number(topicIdRaw);
    if (Number.isFinite(topicId)) {
      scopedPosts = scopedPosts.filter((p) => Number(p.topic_id) === topicId);
    }
  }

  const tokens = tokenize(q);

  function rank(posts: MetaPost[]) {
    return posts
    .map((p) => {
      const rel = scorePost(p, tokens);
      return {
        post_id: String(p.post_id ?? "unknown"),
        text: String(p.text ?? ""),
        author: String(p.author ?? "unknown"),
        subreddit: String(p.subreddit ?? "unknown"),
        topic_id: Number(p.topic_id ?? -1),
        created_utc: Number(p.created_utc ?? 0),
        date: toDate(Number(p.created_utc ?? 0)),
        score: Number(p.score ?? 0),
        match_score: Number(rel.score.toFixed(3)),
        matched_terms: rel.matched,
        analysis: {
          amplification: Number(p.score ?? 0) > 100 ? "high" : Number(p.score ?? 0) > 20 ? "medium" : "low",
          stance_hint: Number(p.topic_id ?? -1) === -1 ? "background chatter" : `topic #${Number(p.topic_id)}`,
          why_matched: rel.matched.length ? `Matched terms: ${rel.matched.join(", ")}` : "No explicit keyword match; ranked by metadata and score",
        },
      };
    })
    .filter((row) => (tokens.length ? row.matched_terms.length > 0 : true))
    .sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      if (b.score !== a.score) return b.score - a.score;
      return b.created_utc - a.created_utc;
    });
  }

  const ranked = rank(scopedPosts);
  const total = ranked.length;
  const result = ranked.slice(offset, offset + limit);

  let totalAllTopics = total;
  if (topicIdRaw !== null && topicIdRaw !== "") {
    totalAllTopics = rank(baseFiltered).length;
  }

  const subredditCounts = new Map<string, number>();
  const topicCounts = new Map<number, number>();
  for (const r of result) {
    subredditCounts.set(r.subreddit, (subredditCounts.get(r.subreddit) ?? 0) + 1);
    topicCounts.set(r.topic_id, (topicCounts.get(r.topic_id) ?? 0) + 1);
  }

  return NextResponse.json({
    query: q,
    total,
    returned: result.length,
    offset,
    limit,
    has_more: offset + result.length < total,
    filters: {
      topic_id: topicIdRaw === null || topicIdRaw === "" ? null : Number(topicIdRaw),
      subreddit: subreddit || null,
      author: author || null,
      limit,
      offset,
    },
    summary: {
      top_subreddits: [...subredditCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      top_topics: [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    },
    total_all_topics: totalAllTopics,
    posts: result,
  });
}
