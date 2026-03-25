/**
 * POST /api/live/inject
 *
 * Live post injection via Reddit API + Groq LLM classification.
 *
 * Accepts:
 *   { query: string, limit?: number }
 *
 * Process:
 *   1. Fetch recent Reddit posts matching query (authenticated)
 *   2. Extract: title, selftext, subreddit, author, score, created_utc, url
 *   3. Fetch existing cluster labels from /api/clusters
 *   4. Classify each post into clusters using Groq LLM (mixtral-8x7b)
 *   5. Return posts array with cluster assignments attached
 *
 * Requires:
 *   - GROQ_API_KEY
 *   - REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD, REDDIT_USER_AGENT
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getGroqApiKeys, withGroqKeyRotation } from "@/lib/groqRotator";

// ── Types ──────────────────────────────────────────────────────────────────

interface RedditPost {
  title: string;
  selftext: string;
  subreddit: string;
  author: string;
  score: number;
  created_utc: number;
  url: string;
}

interface ClusterAssignment {
  cluster: string;
  cluster_id: number;
  confidence: number;
  is_new_narrative: boolean;
  reasoning: string;
}

interface InjectedPost extends RedditPost {
  assignment: ClusterAssignment;
}

interface TopicCluster {
  id: number;
  name: string;
  top_words: string[];
  count: number;
  color: string;
  centroid_x: number;
  centroid_y: number;
}

interface ClusterData {
  topics: TopicCluster[];
  meta?: Record<string, unknown>;
}

interface AnthropicMessage {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

// ── Helper: Load clusters ──────────────────────────────────────────────────

async function loadClusters(): Promise<TopicCluster[]> {
  try {
    // Try to load from file first
    const filePath = path.join(process.cwd(), "public", "data", "topics.json");
    if (fs.existsSync(filePath)) {
      const data: ClusterData = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      );
      return data.topics;
    }
  } catch {
    // Fall through to demo data
  }

  // Demo fallback
  return [
    {
      id: 0,
      name: "electoral politics",
      top_words: ["election", "ballot", "turnout", "campaign"],
      count: 124318,
      color: "#1D9E75",
      centroid_x: -3.2,
      centroid_y: 1.8,
    },
    {
      id: 1,
      name: "social movements",
      top_words: ["protest", "activism", "movement", "rights"],
      count: 89405,
      color: "#7F77DD",
      centroid_x: 2.1,
      centroid_y: -1.3,
    },
    {
      id: 2,
      name: "policy debate",
      top_words: ["legislation", "policy", "law", "regulation"],
      count: 76230,
      color: "#BA7517",
      centroid_x: -1.5,
      centroid_y: 3.2,
    },
  ];
}

// ── Helper: Get Reddit OAuth token ────────────────────────────────────────

interface RedditAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let redditAccessToken: string | null = null;
let redditTokenExpiry: number = 0;

async function getRedditToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (redditAccessToken && redditTokenExpiry > now) {
    return redditAccessToken;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error(
      "Missing Reddit credentials: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "TrendLens/1.0",
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Reddit auth failed: ${response.status} ${errText}`);
  }

  const data = await response.json() as RedditAuthResponse;
  redditAccessToken = data.access_token;
  redditTokenExpiry = now + data.expires_in * 1000 - 60000; // Refresh 1 min before expiry

  return redditAccessToken;
}

// ── Helper: Fetch Reddit posts (authenticated) ────────────────────────────

async function fetchRedditPosts(
  query: string,
  limit: number
): Promise<RedditPost[]> {
  // Get authenticated token
  const token = await getRedditToken();

  const url = new URL("https://oauth.reddit.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "new");
  url.searchParams.set("limit", Math.min(limit, 100).toString());
  url.searchParams.set("t", "week"); // Search last week for freshness

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT || "TrendLens/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = await response.json() as {
    data?: {
      children?: Array<{
        data?: {
          title?: string;
          selftext?: string;
          subreddit?: string;
          author?: string;
          score?: number;
          created_utc?: number;
          url?: string;
        };
      }>;
    };
  };

  const posts: RedditPost[] = [];
  const children = data.data?.children ?? [];

  for (const child of children) {
    const post = child.data;
    if (!post) continue;

    posts.push({
      title: post.title ?? "",
      selftext: post.selftext ?? "",
      subreddit: post.subreddit ?? "unknown",
      author: post.author ?? "[deleted]",
      score: post.score ?? 0,
      created_utc: post.created_utc ?? 0,
      url: post.url ?? "",
    });
  }

  return posts;
}

// ── Helper: Classify posts with Groq ──────────────────────────────────────

interface GroqMessage {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const GROQ_MODEL_CANDIDATES = [
  process.env.GROQ_MODEL_LIVE_INJECT,
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
].filter((m): m is string => Boolean(m && m.trim()));

function isModelDecommissionedError(status: number, body: string): boolean {
  if (status !== 400) return false;
  const text = body.toLowerCase();
  return text.includes("model_decommissioned") || text.includes("decommissioned");
}

async function classifyPostsWithGroq(
  posts: RedditPost[],
  clusters: TopicCluster[]
): Promise<ClusterAssignment[]> {
  if (!getGroqApiKeys().length) {
    throw new Error("GROQ_API_KEY environment variable not set");
  }

  const clusterLabels = clusters.map((c) => `"${c.name}"`).join(", ");

  // Build batch prompt for efficiency
  const postsAsJson = posts
    .map((post, i) => ({
      id: i,
      text: `${post.title}\n${post.selftext}`.slice(0, 1000),
    }))
    .map((p) => JSON.stringify(p))
    .join("\n");

  const systemPrompt = `You are a narrative cluster classification system. Classify each Reddit post into one of the existing narrative clusters.

Existing clusters: ${clusterLabels}

For each post, return a JSON object with:
- cluster: the closest cluster name (or "new_narrative" if none fit)
- cluster_id: numeric ID if matched, or -1 if new
- confidence: 0-1 confidence score
- is_new_narrative: boolean
- reasoning: brief explanation (1-2 sentences)`;

  const userPrompt = `Classify these posts:\n\n${postsAsJson}\n\nReturn a JSON array of classification objects, one per post, in the same order as the input.`;

  const result = await withGroqKeyRotation(async (apiKey) => {
    let lastError = "";

    for (let i = 0; i < GROQ_MODEL_CANDIDATES.length; i++) {
      const model = GROQ_MODEL_CANDIDATES[i]!;
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        return (await response.json()) as GroqMessage;
      }

      const errData = await response.text();
      lastError = `Groq API error: ${response.status} ${errData}`;

      if (response.status === 429) {
        throw new Error(lastError);
      }

      const hasFallback = i < GROQ_MODEL_CANDIDATES.length - 1;
      if (hasFallback && isModelDecommissionedError(response.status, errData)) {
        continue;
      }

      throw new Error(lastError);
    }

    throw new Error(lastError || "Groq API error: No model candidates succeeded");
  });

  const textContent = result.choices?.[0]?.message?.content ?? "";

  // Extract JSON from response
  const jsonMatch = textContent.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Groq response did not contain valid JSON array");
  }

  let assignments: Array<{
    cluster: string;
    cluster_id?: number;
    confidence: number;
    is_new_narrative: boolean;
    reasoning: string;
  }>;

  try {
    assignments = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error("Failed to parse Groq JSON response");
  }

  // Normalize cluster_id: resolve cluster names to IDs
  return assignments.map((assign) => {
    let clusterId = assign.cluster_id ?? -1;

    if (clusterId === -1) {
      const matched = clusters.find(
        (c) => c.name.toLowerCase() === assign.cluster.toLowerCase()
      );
      if (matched) {
        clusterId = matched.id;
      }
    }

    return {
      cluster: assign.cluster,
      cluster_id: clusterId,
      confidence: Math.max(0, Math.min(1, assign.confidence)),
      is_new_narrative: assign.is_new_narrative,
      reasoning: assign.reasoning,
    };
  });
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      query?: string;
      limit?: number;
    };
    const { query, limit = 25 } = body;

    // Validate input
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "query parameter is required and must be a string" },
        { status: 400 }
      );
    }

    const parsedLimit = Math.min(Math.max(1, limit || 25), 100);

    // Fetch clusters and posts in parallel
    const [clusters, posts] = await Promise.all([
      loadClusters(),
      fetchRedditPosts(query, parsedLimit),
    ]);

    if (posts.length === 0) {
      return NextResponse.json(
        { posts: [], query, message: "No posts found matching query" },
        { status: 200 }
      );
    }

    // Classify posts
    const assignments = await classifyPostsWithGroq(posts, clusters);

    // Merge assignments with post data
    const injectedPosts: InjectedPost[] = posts.map((post, i) => ({
      ...post,
      assignment: assignments[i],
    }));

    return NextResponse.json(
      {
        posts: injectedPosts,
        query,
        total: injectedPosts.length,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[/api/live/inject]", error);

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && message.includes("400") ? 400 : 500 }
    );
  }
}
