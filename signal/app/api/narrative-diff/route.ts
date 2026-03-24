import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface Post {
  topic_id?: number;
  text?: string;
  created_utc?: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "it", "in", "of", "to", "and", "or", "but", "not", "that", "this", "was", "are",
  "for", "on", "at", "by", "be", "as", "we", "they", "with", "have", "from", "has", "its", "been", "were", "will",
]);

function topWords(posts: Post[], n = 40): Array<{ term: string; count: number }> {
  const freq = new Map<string, number>();
  for (const p of posts) {
    const words = (p.text ?? "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOPWORDS.has(w));
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term, count]) => ({ term, count }));
}

export async function GET() {
  const artifact = path.join(process.cwd(), "public", "data", "narrative_diff.json");
  if (fs.existsSync(artifact)) {
    return NextResponse.json(JSON.parse(fs.readFileSync(artifact, "utf-8")));
  }

  const metaPath = path.join(process.cwd(), "data", "faiss_meta.json");
  if (!fs.existsSync(metaPath)) return NextResponse.json({ diffs: [] });

  const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { posts?: Post[] };
  const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

  const byTopic = new Map<number, Post[]>();
  for (const p of posts) {
    const tid = Number(p.topic_id);
    if (!Number.isFinite(tid) || tid < 0) continue;
    if (!byTopic.has(tid)) byTopic.set(tid, []);
    byTopic.get(tid)?.push(p);
  }

  const diffs = [...byTopic.entries()].map(([topic_id, topicPosts]) => {
    const sorted = [...topicPosts].sort((a, b) => Number(a.created_utc ?? 0) - Number(b.created_utc ?? 0));
    const mid = Math.floor(sorted.length / 2);
    const early = sorted.slice(0, mid);
    const recent = sorted.slice(mid);

    const earlyTop = topWords(early, 50);
    const recentTop = topWords(recent, 80);

    const earlySet = new Set(earlyTop.map((x) => x.term));
    const recentSet = new Set(recentTop.map((x) => x.term));

    const added = recentTop.filter((x) => !earlySet.has(x.term)).slice(0, 8);
    const dropped = earlyTop.filter((x) => !recentSet.has(x.term)).slice(0, 8);

    return { topic_id, added, dropped };
  });

  return NextResponse.json({ diffs });
}
