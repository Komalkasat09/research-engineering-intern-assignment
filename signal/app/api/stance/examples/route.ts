import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface MetaPost {
  post_id?: string;
  text?: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
}

interface BlindSpotExample {
  post_id: string;
  subreddit: string;
  author: string;
  score: number;
  date: string;
  text: string;
  bucket: "pro_leaning_subreddit" | "anti_leaning_subreddit" | "ambiguous_style";
}

function toDate(createdUtc: number | undefined): string {
  if (!createdUtc || !Number.isFinite(createdUtc)) return "unknown";
  return new Date(createdUtc * 1000).toISOString().slice(0, 10);
}

function isAmbiguousStyle(text: string): boolean {
  const low = text.toLowerCase();
  const explicitMarkers = [
    "support", "oppose", "against", "back", "endorse", "condemn", "vote", "policy", "administration",
    "biden", "trump", "democrat", "republican",
  ];
  return explicitMarkers.every((m) => !low.includes(m));
}

export async function GET() {
  const filePath = path.join(process.cwd(), "data", "faiss_meta.json");
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ examples: [] as BlindSpotExample[] });
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { posts?: MetaPost[] };
  const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

  const norm = posts
    .filter((p) => (p.text ?? "").trim().length > 80)
    .map((p) => ({
      post_id: p.post_id ?? "unknown",
      subreddit: p.subreddit ?? "r/unknown",
      author: p.author ?? "u/unknown",
      score: Number(p.score ?? 0),
      date: toDate(p.created_utc),
      text: (p.text ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    }));

  const proLeaning = norm
    .filter((p) => /^r\/Conservative$/i.test(p.subreddit))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((p) => ({ ...p, bucket: "pro_leaning_subreddit" as const }));

  const antiLeaning = norm
    .filter((p) => /^r\/Anarchism$/i.test(p.subreddit))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((p) => ({ ...p, bucket: "anti_leaning_subreddit" as const }));

  const ambiguous = norm
    .filter((p) => isAmbiguousStyle(p.text))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((p) => ({ ...p, bucket: "ambiguous_style" as const }));

  const examples: BlindSpotExample[] = [...proLeaning, ...antiLeaning, ...ambiguous];
  return NextResponse.json({ examples });
}
