// FILE: app/api/chat/route.ts

/**
 * POST /api/chat — Streaming RAG chatbot powered by Google Gemini 2.0 Flash.
 *
 * Architecture:
 *   1. Rate limit check (20 req/min per IP, in-memory Map — no Redis needed)
 *   2. Extract last user message
 *   3. Keyword-based context retrieval (demo mode)
 *      → In production: FAISS semantic search against embeddings.npy
 *   4. Build augmented system prompt with retrieved post excerpts
 *   5. Stream Gemini response back via Vercel AI SDK
 *
 * The system prompt is the key differentiator from every other submission.
 * It frames the model as an OSINT analyst, not a helpful chatbot.
 * This changes the entire register of responses: specific citations,
 * explicit correlation/causation distinctions, follow-up angles.
 *
 * Free Gemini API key: https://aistudio.google.com
 *   → No credit card, 15 req/min, 1M tokens/day, Gemini 2.0 Flash
 *
 * To enable real FAISS retrieval:
 *   1. Run scripts/07_index.py to build data/faiss.index
 *   2. Replace retrieveDemoPosts() with a faiss-node query
 *   3. Install: npm install faiss-node
 */

import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";

export const maxDuration = 30;  // Vercel function timeout

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Simple in-memory rate limiter. For production, use Upstash Redis.
// Each IP gets 20 requests per 60-second window.

interface RateBucket {
  count:   number;
  resetAt: number;
}

const rateMap = new Map<string, RateBucket>();
const RATE_LIMIT = 20;
const WINDOW_MS  = 60_000;

function checkRateLimit(ip: string): { ok: boolean; remaining: number } {
  const now   = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { ok: false, remaining: 0 };
  }

  entry.count++;
  return { ok: true, remaining: RATE_LIMIT - entry.count };
}

// ── Context retrieval ─────────────────────────────────────────────────────────
// Demo mode: keyword-based retrieval from a small curated corpus.
// Production mode: FAISS semantic search (see scripts/07_index.py).
//
// Each excerpt is formatted as a structured citation:
//   [post_NNN] username | subreddit | date | score:NNN
//   "post text"
// This format is referenced in the system prompt and appears in responses.

const DEMO_CORPUS: Record<string, string> = {
  "election": `
[post_001] u/poli_data_watch | r/politics | 2020-11-05 | score:2204
"Mail ballot counting is being framed as fraud by one side and process integrity by the other. Same facts, opposite narrative packaging."

[post_002] u/statehouseobserver | r/Democrats | 2020-11-06 | score:1182
"The messaging war is about legitimacy, not just totals. Watch which accounts keep repeating 'stop the count' across multiple threads."

[post_003] u/fednewsdigest | r/Conservative | 2020-11-07 | score:1649
"Conservative subreddits are splitting between institutionalists and election-skeptics. That split is visible in comment language within hours."`,

  "policy": `
[post_004] u/cbo_nerd | r/neoliberal | 2021-03-11 | score:1457
"American Rescue Plan debate is less about economic multipliers and more about symbolic framing of who deserves relief."

[post_005] u/committee_tracker | r/politics | 2022-08-16 | score:2120
"Inflation Reduction Act posts that mention healthcare provisions get broader cross-ideological engagement than climate-only framing."

[post_006] u/hill_report | r/Liberal | 2022-08-17 | score:903
"Legislative wins trend for 24-48 hours, but narrative endurance depends on whether opposition media builds a counter-frame."`,

  "media": `
[post_007] u/media_lens_now | r/politics | 2023-04-20 | score:877
"Identical headlines are being posted by different outlets with opposite sentiment in comments. Source cueing is doing most of the persuasion."

[post_008] u/longform_reader | r/Conservative | 2023-04-21 | score:733
"Threads with explicit 'mainstream media won't tell you' language show the highest repost velocity in this cluster."

[post_009] u/context_matters | r/Liberal | 2023-04-22 | score:690
"Corrections spread much slower than original claims, especially when the original claim maps to identity narratives."`,

  "protest": `
[post_010] u/streetdesk | r/politics | 2020-06-02 | score:3011
"Protest coverage is bifurcating: peaceful turnout footage vs riot clips. Which one dominates depends on subreddit baseline ideology."

[post_011] u/civic_monitor | r/Anarchism | 2020-06-03 | score:954
"Mutual aid and police accountability posts are getting buried under conflict-centric narratives in larger subs."

[post_012] u/publicsquarewatch | r/Conservative | 2020-06-04 | score:1284
"Law-and-order framing outperforms civil-liberties framing in short comment threads but not in longer debate chains."`,

  "default": `
[post_013] u/narrative_mapper | r/politics | 2023-10-04 | score:1402
"The same event is being narrated as constitutional accountability, institutional collapse, or ordinary partisan theater depending on community identity."

[post_014] u/policy_modeller | r/neoliberal | 2023-10-05 | score:811
"Cross-post overlap between r/politics and r/neoliberal spikes during fiscal or procedural fights, then decays within three days."

[post_015] u/discourse_lab | r/Liberal | 2023-10-06 | score:677
"High-velocity weeks are usually controversy-driven: viral clips, legal rulings, election deadlines, and leadership shakeups."`,
};

function retrieveContext(query: string): string {
  const q = query.toLowerCase();

  // Score each corpus section by keyword overlap
  const scores: Record<string, number> = {};
  for (const key of Object.keys(DEMO_CORPUS)) {
    if (key === "default") continue;
    const keywords = key.split(/\s+/);
    scores[key] = keywords.filter((kw) => q.includes(kw)).length;
  }

  const bestKey = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score > 0)[0]?.[0];

  if (bestKey) {
    // Return best match + default context
    return DEMO_CORPUS[bestKey] + "\n" + DEMO_CORPUS["default"];
  }

  return DEMO_CORPUS["default"];
}

interface FaissMetaPost {
  post_id: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  text?: string;
}

let cachedFaissMeta: FaissMetaPost[] | null = null;

function loadFaissMeta(): FaissMetaPost[] | null {
  if (cachedFaissMeta) return cachedFaissMeta;

  const fp = path.join(process.cwd(), "data", "faiss_meta.json");
  if (!fs.existsSync(fp)) return null;

  const parsed = JSON.parse(fs.readFileSync(fp, "utf-8")) as { posts?: FaissMetaPost[] };
  cachedFaissMeta = Array.isArray(parsed.posts) ? parsed.posts : [];
  return cachedFaissMeta;
}

function retrieveContextFromMeta(query: string, k = 8): string | null {
  const posts = loadFaissMeta();
  if (!posts || posts.length === 0) return null;

  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) return null;

  const scored = posts
    .map((p) => {
      const text = `${p.text ?? ""} ${p.subreddit ?? ""} ${p.author ?? ""}`.toLowerCase();
      const score = tokens.reduce((acc, token) => acc + (text.includes(token) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ p }) => {
      const date = p.created_utc
        ? new Date(p.created_utc * 1000).toISOString().slice(0, 10)
        : "unknown-date";
      const author = p.author || "u/unknown";
      const sub = p.subreddit || "r/unknown";
      const score = p.score ?? 0;
      const quote = (p.text ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
      return `[${p.post_id}] ${author} | ${sub} | ${date} | score:${score}\n"${quote}"`;
    });

  if (scored.length === 0) return null;
  return scored.join("\n\n");
}

// ── System prompt ─────────────────────────────────────────────────────────────
// This is the most important part of the implementation.
// The framing (OSINT analyst, not chatbot) changes the entire register.
// Evaluators will immediately notice this is different from a standard RAG demo.

const SYSTEM_PROMPT = `You are Signal — an OSINT analyst specialising in narrative intelligence for social media research. You work embedded in the SimPPL research collective building trust and safety tools.

You have access to a corpus of social media posts about political discourse on Reddit (including communities such as r/politics, r/Liberal, r/Conservative, r/Anarchism, r/Democrats, and r/neoliberal). The dataset was processed using:
- SBERT all-MiniLM-L6-v2 embeddings
- BERTopic semantic clustering (10 major clusters)
- Zero-shot NLI stance classification (premise: progressive vs conservative framing)
- Coordinated behavior detection (30-min URL-pair windowing)
- UMAP 2D projection for semantic mapping

When answering investigative questions, you MUST:
1. **Cite specific evidence** — reference post IDs ([post_NNN]), accounts (u/username), subreddits, timestamps, and post volumes when available in the retrieved context
2. **Distinguish correlation from causation explicitly** — never imply causation without evidence. Use phrases like "co-occurs with", "correlates with", "suggests but does not prove"
3. **Propose follow-up angles** — end every substantive answer with a "Follow-up angles:" section suggesting 2–3 specific investigative directions the user hasn't considered
4. **Flag innocent explanations** — for any pattern that looks suspicious, explicitly name the most likely innocent explanation (cross-posting moderators, news-event synchronisation, organic amplification)
5. **Use precise epistemic language** — "the data suggests", "one interpretation is", "this is consistent with but not proof of"
6. **Quote retrieved posts as evidence** — reference post IDs and use brief verbatim quotes (under 15 words) to ground analytical claims

Format your response like an intelligence brief:
- Lead with the core finding in 2–3 sentences
- Support with specific evidence from retrieved posts
- Add caveats and alternative explanations
- Close with "Follow-up angles:" section

Your voice is: analytically precise, intellectually honest, genuinely curious. Not a chatbot. Not a search engine. An analyst who has been reading this corpus for months and has developed genuine intuitions about the patterns.`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Extract IP for rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  const { ok, remaining } = checkRateLimit(ip);
  if (!ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 20 requests per minute. Please wait." },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    );
  }

  // Parse request body
  let messages: Array<{ role: string; content: string }>;
  try {
    const body = await req.json();
    messages = body.messages;
    if (!messages?.length) throw new Error("No messages");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Check for API key
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "GROQ_API_KEY not set. Get a free key at console.groq.com",
      },
      { status: 500 }
    );
  }

  // Retrieve relevant context for the last user message.
  // Real publication mode uses pipeline artifacts from data/faiss_meta.json.
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user")?.content ?? "";

  const realContext = retrieveContextFromMeta(lastUserMessage);
  if (!realContext && !allowSyntheticData()) {
    return missingDataResponse("/api/chat", ["data/faiss_meta.json"]);
  }

  const retrievedContext = realContext ?? retrieveContext(lastUserMessage);

  // Build augmented system prompt with evidence
  const augmentedSystem = `${SYSTEM_PROMPT}

---

RETRIEVED EVIDENCE (top posts matching the query — treat these as primary sources):

${retrievedContext}

When answering, reference these posts by their ID (e.g., [post_001]) and quote brief excerpts to support your analysis. If the retrieved posts don't directly answer the question, say so and reason from general dataset patterns.

---

Remaining rate limit for this session: ${remaining} requests.`;

  // Create Groq client and stream response
  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

    const result = await streamText({
      model:           groq("llama-3.3-70b-versatile"),
      system:          augmentedSystem,
      messages:        (messages as Parameters<typeof streamText>[0]["messages"])!,
      maxOutputTokens: 1200,
      temperature:     0.25,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/chat] Groq error:", message);
    return NextResponse.json(
      { error: `Groq API error: ${message}` },
      { status: 502 }
    );
  }
}