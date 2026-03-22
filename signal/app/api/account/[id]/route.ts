import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const TOPIC_NAMES: Record<number, string> = {
  0: "electoral politics",
  1: "anarchist / socialist",
  2: "Musk / DOGE",
  3: "Ukraine / Russia",
  4: "tariffs / trade",
  5: "immigration / ICE",
  6: "federal workers",
  7: "general discussion",
};

const TOPIC_COLORS: Record<number, string> = {
  0: "#1D9E75", 1: "#7F77DD", 2: "#D85A30", 3: "#BA7517",
  4: "#378ADD", 5: "#D4537E", 6: "#639922", 7: "#888780",
};

type MetaPost = {
  post_id?: string;
  author?: string;
  text?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  topic_id?: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const accountId = decodeURIComponent(id);

  // Try to load real post data from faiss_meta.json
  const metaPath = path.join(process.cwd(), "data", "faiss_meta.json");

  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      const posts: MetaPost[] = (meta.posts ?? []).filter(
        (p: MetaPost) => p.author === accountId
      );

      if (posts.length > 0) {
        // Count topics
        const topicCounts: Record<number, number> = {};
        for (const p of posts) {
          const tid = p.topic_id ?? -1;
          if (tid >= 0) topicCounts[tid] = (topicCounts[tid] ?? 0) + 1;
        }

        const topicProfile = Object.entries(topicCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([tid, count]) => ({
            topic_id: parseInt(tid, 10),
            name: TOPIC_NAMES[parseInt(tid, 10)] ?? `topic ${tid}`,
            color: TOPIC_COLORS[parseInt(tid, 10)] ?? "#888780",
            count,
          }));

        const isBridge = topicProfile.length >= 2;

        return NextResponse.json({
          id: accountId,
          post_count: posts.length,
          topic_profile: topicProfile,
          is_bridge: isBridge,
          posts: posts.slice(0, 5).map((p: MetaPost) => ({
            post_id: p.post_id ?? "",
            text: p.text?.slice(0, 280) ?? "",
            subreddit: p.subreddit ?? "",
            date: p.created_utc
              ? new Date(p.created_utc * 1000).toISOString().slice(0, 10)
              : "unknown",
            score: p.score ?? 0,
            topic_id: p.topic_id ?? -1,
            topic_name: TOPIC_NAMES[p.topic_id ?? -1] ?? "unknown",
          })),
        });
      }
    } catch (e) {
      console.error("Error loading faiss_meta:", e);
    }
  }

  // Fallback — return structured empty response
  return NextResponse.json({
    id: accountId,
    post_count: 0,
    topic_profile: [],
    is_bridge: false,
    posts: [],
    note: "Run the pipeline to see real post data for this account",
  });
}
