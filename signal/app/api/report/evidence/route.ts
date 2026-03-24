import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MetaPost {
  post_id?: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  text?: string;
}

function toDate(ts: number | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "unknown";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "Signal Evidence Notebook");
  const messages = (body.messages ?? []) as ChatMessage[];

  const citationMatches = (messages.map((m) => m.content).join("\n").match(/\[(.*?)\]/g) ?? [])
    .map((x) => x.replace(/[\[\]]/g, ""))
    .filter(Boolean);

  const metaPath = path.join(process.cwd(), "data", "faiss_meta.json");
  const posts = fs.existsSync(metaPath)
    ? ((JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { posts?: MetaPost[] }).posts ?? [])
    : [];

  const postMap = new Map(posts.map((p) => [String(p.post_id), p]));
  const cited = [...new Set(citationMatches)]
    .map((id) => ({ id, post: postMap.get(id) }))
    .filter((x) => x.post);

  const markdown = [
    `# ${title}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Conversation",
    "",
    ...messages.map((m) => `- **${m.role}**: ${m.content}`),
    "",
    "## Cited Evidence",
    "",
    ...cited.map(({ id, post }) => `- [${id}] ${(post?.author ?? "u/unknown")} | ${(post?.subreddit ?? "r/unknown")} | ${toDate(post?.created_utc)} | score:${post?.score ?? 0}\n  - ${(post?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 240)}`),
  ].join("\n");

  return NextResponse.json({ title, markdown, citations: cited.length });
}
