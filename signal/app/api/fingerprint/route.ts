/**
 * POST /api/fingerprint — Narrative fingerprint simulation.
 *
 * Simulates how 5 Reddit community archetypes would react to a given narrative.
 * Streams a structured response with per-archetype reactions, contagion score,
 * and fracture point analysis.
 *
 * Model: Gemini 2.0 Flash, temperature 0.4 (more creative than the chatbot)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getGroqApiKeys, withGroqKeyRotation } from "@/lib/groqRotator";

export const maxDuration = 30;

const FINGERPRINT_MODEL_CANDIDATES = [
  process.env.GROQ_MODEL_FINGERPRINT,
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
].filter((m): m is string => Boolean(m && m.trim()));

function isModelDecommissionedError(status: number, body: string): boolean {
  if (status !== 400) return false;
  const text = body.toLowerCase();
  return text.includes("model_decommissioned") || text.includes("decommissioned");
}

const archetypes = [
  {
    name: "Mainstream political",
    subs: "r/politics",
    style: "institutional framing, outrage at norm violations, calls for accountability, appeals to democracy",
  },
  {
    name: "Anarchist / anti-state",
    subs: "r/Anarchism",
    style: "anti-establishment, anti-capitalist, views all government as oppression, calls for direct action",
  },
  {
    name: "Technocratic centrist",
    subs: "r/neoliberal",
    style: "data-driven, policy-focused, skeptical of both left populism and right populism, values institutions",
  },
  {
    name: "Conservative / pro-DOGE",
    subs: "r/Conservative",
    style: "anti-government spending, pro-Trump, frames federal workers as wasteful bureaucrats, supports deregulation",
  },
  {
    name: "Institutional Democrat",
    subs: "r/democrats",
    style: "defends democratic institutions, calls for legislative action, frames issues as constitutional crises",
  },
];

const archetypeBlock = archetypes
  .map((a, i) => `${i + 1}. **${a.name}** (${a.subs}) — ${a.style}`)
  .join("\n");

const SYSTEM_PROMPT = `You are Signal — a narrative intelligence analyst simulating how different Reddit communities would react to a given narrative or claim.

Simulate how Reddit political communities react to this narrative. Each community has a distinct ideological lens. Be specific about how each community's existing beliefs shape their interpretation.

You will be given a NARRATIVE and optionally a CLUSTER context. For each of the 5 community archetypes below, simulate an authentic reaction.

ARCHETYPES:
${archetypeBlock}

For EACH archetype, output a section in this EXACT format:

### [Archetype Name]
REACTION: [2 sentences in authentic Reddit voice for that community]
AMPLIFY or SUPPRESS: [one word] — [one sentence explaining why]
MUTATION: [how they reframe the narrative when sharing it]

After all 5 archetypes, output:

CONTAGION SCORE: [X/10] — [one sentence explaining the score]
FRACTURE POINT: [the single sharpest disagreement between communities]

Be specific, authentic, and analytically precise. Each archetype should sound genuinely different.`;

export async function POST(req: NextRequest) {
  let query: string;
  let topicId: number | undefined;

  try {
    const body = await req.json();
    query   = body.query;
    topicId = body.topicId;
    if (!query?.trim()) throw new Error("No query");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!getGroqApiKeys().length) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not set. Add GROQ_API_KEY (or GROQ_API_KEY_2..N) in .env.local" },
      { status: 500 }
    );
  }

  const userPrompt = `NARRATIVE: ${query}${topicId !== undefined ? `\nCLUSTER: #${topicId}` : ""}`;

  try {
    const completionText = await withGroqKeyRotation(async (apiKey) => {
      let lastError = "";

      for (let i = 0; i < FINGERPRINT_MODEL_CANDIDATES.length; i++) {
        const model = FINGERPRINT_MODEL_CANDIDATES[i]!;
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 1400,
            temperature: 0.4,
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

        const hasFallback = i < FINGERPRINT_MODEL_CANDIDATES.length - 1;
        if (hasFallback && isModelDecommissionedError(response.status, errData)) {
          continue;
        }

        throw new Error(lastError);
      }

      throw new Error(lastError || "Groq API error: No model candidates succeeded");
    });

    return new Response(completionText, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/fingerprint] Groq error:", message);
    return NextResponse.json(
      { error: `Groq API error: ${message}` },
      { status: 502 }
    );
  }
}
