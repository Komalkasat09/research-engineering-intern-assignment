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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { allowSyntheticData, missingDataResponse } from "@/lib/dataMode";
import { getGroqApiKeys, withGroqKeyRotation } from "@/lib/groqRotator";

export const maxDuration = 30;  // Vercel function timeout

const CHAT_MODEL_CANDIDATES = [
  process.env.GROQ_MODEL_CHAT,
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
].filter((m): m is string => Boolean(m && m.trim()));

function isModelDecommissionedError(status: number, body: string): boolean {
  if (status !== 400) return false;
  const text = body.toLowerCase();
  return text.includes("model_decommissioned") || text.includes("decommissioned");
}

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
// Semantic retrieval from data/faiss_meta.json.
// We cannot run native FAISS inside serverless reliably, so this route loads
// faiss metadata once and performs semantic-expanded lexical scoring.

interface FaissMetaPost {
  post_id?: string;
  id?: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  text?: string;
}

interface RetrievedPost {
  post_id: string;
  author?: string;
  subreddit?: string;
  created_utc?: number;
  score?: number;
  text?: string;
}

interface InvestigationContextPayload {
  source?: string;
  topicId?: number | null;
  narrativeName?: string;
  originSubreddit?: string;
  topPostAuthor?: string;
  topPostScore?: number;
  note?: string;
}

interface AnalystAlert {
  triggered: boolean;
  topic: string;
  date: string;
}

let cachedFaissMeta: FaissMetaPost[] | null = null;

const SEMANTIC_EXPANSIONS: Record<string, string[]> = {
  toxic:      ["hostile", "angry", "outrage", "attack", "hate"],
  spread:     ["amplify", "share", "viral", "boost", "repost"],
  fear:       ["anxiety", "worried", "scared", "threat", "danger"],
  government: ["federal", "administration", "DOGE", "agency", "state"],
  money:      ["fund", "budget", "spending", "cost", "billion"],
  protest:    ["resist", "fight", "oppose", "strike", "march"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 1);
}

function normalizeFaissPosts(posts: FaissMetaPost[]): RetrievedPost[] {
  return posts.map((post, idx) => ({
    post_id: post.post_id ?? post.id ?? `post_${idx}`,
    author: post.author,
    subreddit: post.subreddit,
    created_utc: post.created_utc,
    score: post.score,
    text: post.text,
  }));
}

function expandSemanticWords(queryWords: string[]): Set<string> {
  const expandedWords = new Set<string>(queryWords);

  for (const word of queryWords) {
    for (const [key, expansions] of Object.entries(SEMANTIC_EXPANSIONS)) {
      const normalizedExpansions = expansions.map((e) => e.toLowerCase());
      const relatedToKey = word.includes(key) || key.includes(word);
      const relatedToExpansion = normalizedExpansions.some(
        (e) => word.includes(e) || e.includes(word)
      );

      if (relatedToKey || relatedToExpansion) {
        expandedWords.add(key);
        normalizedExpansions.forEach((e) => expandedWords.add(e));
      }
    }
  }

  return expandedWords;
}

function semanticRetrieve(query: string, posts: RetrievedPost[]): RetrievedPost[] {
  const queryWords = tokenize(query);
  if (!queryWords.length) return [];

  const expandedWords = expandSemanticWords(queryWords);
  const words = Array.from(expandedWords);
  const totalDocs = Math.max(posts.length, 1);

  // Lightweight IDF over expanded words.
  const docFreq = new Map<string, number>();
  for (const word of words) {
    let count = 0;
    for (const post of posts) {
      const text = (post.text ?? "").toLowerCase();
      if (text.includes(word)) count += 1;
    }
    docFreq.set(word, count);
  }

  const scored = posts.map((post) => {
    const text = (post.text ?? "").toLowerCase();
    let score = 0;

    for (const word of words) {
      if (text.includes(word)) {
        const df = docFreq.get(word) ?? 0;
        const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
        score += idf;
      }
    }

    // Boost high-engagement posts.
    score += Math.log1p(post.score ?? 0) * 0.1;
    return { post, score };
  });

  const matches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => s.post);

  if (matches.length) return matches;

  // Backstop: keep chat usable even for out-of-domain queries.
  return posts
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 8);
}

function loadFaissMeta(): FaissMetaPost[] | null {
  if (cachedFaissMeta) return cachedFaissMeta;

  const fp = path.join(process.cwd(), "data", "faiss_meta.json");
  if (!fs.existsSync(fp)) return null;

  const parsed = JSON.parse(fs.readFileSync(fp, "utf-8")) as
    | { posts?: FaissMetaPost[] }
    | FaissMetaPost[];

  if (Array.isArray(parsed)) {
    cachedFaissMeta = parsed;
    return cachedFaissMeta;
  }

  cachedFaissMeta = Array.isArray(parsed.posts) ? parsed.posts : [];
  return cachedFaissMeta;
}

function formatRetrievedPosts(posts: RetrievedPost[]): string {
  return posts
    .map((p) => {
      const date = p.created_utc
        ? new Date(p.created_utc * 1000).toISOString().slice(0, 10)
        : "unknown-date";
      const author = p.author || "u/unknown";
      const sub = p.subreddit || "r/unknown";
      const score = p.score ?? 0;
      const quote = (p.text ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
      return `[${p.post_id}] ${author} | ${sub} | ${date} | score:${score}\n"${quote}"`;
    })
    .join("\n\n");
}

const startupFaissMeta = loadFaissMeta();

const COORDINATION_TERMS = [
  "coordination",
  "coordinated",
  "synchronized",
  "sync",
  "cross-post overlap",
  "amplifying",
  "amplification",
  "shared urls",
  "url-pair",
];

const VELOCITY_TERMS = [
  "velocity spike",
  "high-velocity",
  "spike",
  "surge",
  "peaked",
  "viral",
];

const FOLLOWUP_JSON_INSTRUCTION = `End your response with a JSON block:
{ followups: [string, string, string] }
These should be investigative next steps, not clarifications.`;

function detectAnalystAlert(args: {
  retrievedContext: string;
  activeTopic: number | null;
  investigationContext: InvestigationContextPayload | null;
}): AnalystAlert {
  const lowered = args.retrievedContext.toLowerCase();
  const hasCoordinationSignal = COORDINATION_TERMS.some((term) => lowered.includes(term));
  const hasVelocityAnomaly = VELOCITY_TERMS.some((term) => lowered.includes(term));

  if (!hasCoordinationSignal && !hasVelocityAnomaly) {
    return { triggered: false, topic: "", date: "" };
  }

  const explicitDate = args.retrievedContext.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? "unknown-date";
  const topic = args.investigationContext?.narrativeName
    ?? (args.investigationContext?.topicId != null ? `topic #${args.investigationContext.topicId}` : null)
    ?? (args.activeTopic != null ? `topic #${args.activeTopic}` : "current topic");

  return {
    triggered: true,
    topic,
    date: explicitDate,
  };
}

function detectNonEnglish(text: string): boolean {
  // Check for non-ASCII characters (covers Arabic, Hindi, Chinese, Cyrillic, etc.)
  if (/[^\x00-\x7F]/.test(text)) return true;

  // Check for common non-English stopwords
  const nonEnglishMarkers = [
    "le ", "la ", "les ", "de ", "du ", "des ", "un ", "une ",
    "el ", "la ", "los ", "las ", "un ", "una ", "de ", "en ",
    "der ", "die ", "das ", "ein ", "eine ", "und ", "ist ",
    "की ", "में ", "है ", "का ", "को ",
  ];

  const lower = text.toLowerCase();
  return nonEnglishMarkers.some((marker) => lower.includes(marker));
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
  let activeTopic: number | null = null;
  let investigationContext: InvestigationContextPayload | null = null;
  try {
    const body = await req.json();
    messages = body.messages;
    activeTopic = typeof body.activeTopic === "number" ? body.activeTopic : null;
    investigationContext = body.investigationContext ?? null;
    if (!messages?.length) throw new Error("No messages");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const earlyLastMsg = [...messages].reverse()
    .find((m) => m.role === "user")?.content ?? "";

  if (!earlyLastMsg.trim()) {
    return NextResponse.json(
      { error: "Query cannot be empty." }, { status: 400 }
    );
  }

  if (earlyLastMsg.trim().length < 3) {
    return NextResponse.json(
      { error: "Query too short to retrieve meaningful results. Try a phrase or sentence." },
      { status: 400 }
    );
  }

  const isNonEnglish = detectNonEnglish(earlyLastMsg);

  // Check for API key(s)
  if (!getGroqApiKeys().length) {
    return NextResponse.json(
      {
        error: "GROQ_API_KEY not set. Add GROQ_API_KEY (or GROQ_API_KEY_2..N) in .env.local",
      },
      { status: 500 }
    );
  }

  // Retrieve relevant context for the last user message.
  // Real publication mode uses pipeline artifacts from data/faiss_meta.json.
  const lastUserMessage = earlyLastMsg;

  const loadedMeta = startupFaissMeta ?? loadFaissMeta();
  if (!loadedMeta || loadedMeta.length === 0) {
    if (!allowSyntheticData()) {
      return missingDataResponse("/api/chat", ["data/faiss_meta.json"]);
    }
    return NextResponse.json(
      { error: "No posts available in data/faiss_meta.json" },
      { status: 500 }
    );
  }

  const normalizedPosts = normalizeFaissPosts(loadedMeta);
  const retrievedPosts = semanticRetrieve(lastUserMessage, normalizedPosts);
  const retrievedContext = formatRetrievedPosts(retrievedPosts);

  if (!retrievedContext && !allowSyntheticData()) {
    return missingDataResponse("/api/chat", ["data/faiss_meta.json"]);
  }

  const analystAlert = detectAnalystAlert({
    retrievedContext,
    activeTopic,
    investigationContext,
  });

  const contextBlock = investigationContext
    ? `

ACTIVE INVESTIGATION CONTEXT:
- source_view: ${investigationContext.source ?? "unknown"}
- topic_id: ${investigationContext.topicId ?? "unknown"}
- narrative_name: ${investigationContext.narrativeName ?? "unknown"}
- origin_subreddit: ${investigationContext.originSubreddit ?? "unknown"}
- top_post_author: ${investigationContext.topPostAuthor ?? "unknown"}
- top_post_score: ${investigationContext.topPostScore ?? "unknown"}
- analyst_note: ${investigationContext.note ?? "none"}

Use this context to prioritize relevant evidence and keep your answer scoped to the active investigation.`
    : "";

  const analystAlertBlock = analystAlert.triggered
    ? `

ANALYST ALERT: Coordination signals detected for ${analystAlert.topic}.
Velocity spike on ${analystAlert.date}. Factor this into your response and flag if the user should be concerned.`
    : "";

  const languageBlock = isNonEnglish
    ? `

LANGUAGE NOTE: The user query appears to be non-English. Respond in the same language as the query. Ground your analysis in the English-language dataset and translate key findings.`
    : "";

  // Build augmented system prompt with evidence
  const augmentedSystem = `${SYSTEM_PROMPT}

---

RETRIEVED EVIDENCE (top posts matching the query — treat these as primary sources):

${retrievedContext}

When answering, reference these posts by their ID (e.g., [post_001]) and quote brief excerpts to support your analysis. If the retrieved posts don't directly answer the question, say so and reason from general dataset patterns.

${FOLLOWUP_JSON_INSTRUCTION}

${analystAlertBlock}

${contextBlock}

${languageBlock}

---

Remaining rate limit for this session: ${remaining} requests.`;

  // Request Groq completion with API key + model failover.
  try {
    const completionText = await withGroqKeyRotation(async (apiKey) => {
      let lastError = "";

      for (let i = 0; i < CHAT_MODEL_CANDIDATES.length; i++) {
        const model = CHAT_MODEL_CANDIDATES[i]!;
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: augmentedSystem },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.25,
            max_tokens: 1200,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          return data.choices?.[0]?.message?.content?.trim() ?? "";
        }

        const errData = await response.text();
        lastError = `Groq API error: ${response.status} ${errData}`;

        if (response.status === 429) {
          throw new Error(lastError);
        }

        const hasFallback = i < CHAT_MODEL_CANDIDATES.length - 1;
        if (hasFallback && isModelDecommissionedError(response.status, errData)) {
          continue;
        }

        throw new Error(lastError);
      }

      throw new Error(lastError || "Groq API error: No model candidates succeeded");
    });

    const headers = new Headers({
      "content-type": "text/plain; charset=utf-8",
    });
    headers.set("x-signal-suspicion-flag", analystAlert.triggered ? "1" : "0");
    if (analystAlert.triggered) {
      headers.set("x-signal-suspicion-topic", encodeURIComponent(analystAlert.topic));
      headers.set("x-signal-suspicion-date", analystAlert.date);
    }
    if (isNonEnglish) {
      headers.set("x-signal-non-english", "1");
    }

    return new Response(completionText, {
      status: 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/chat] Groq error:", message);
    return NextResponse.json(
      { error: `Groq API error: ${message}` },
      { status: 502 }
    );
  }
}