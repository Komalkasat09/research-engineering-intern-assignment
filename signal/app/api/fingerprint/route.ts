/**
 * POST /api/fingerprint — Narrative fingerprint simulation.
 *
 * Simulates how 5 Reddit community archetypes would react to a given narrative.
 * Streams a structured response with per-archetype reactions, contagion score,
 * and fracture point analysis.
 *
 * Model: Gemini 2.0 Flash, temperature 0.4 (more creative than the chatbot)
 */

import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const maxDuration = 30;

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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not set. Get a free key at console.groq.com" },
      { status: 500 }
    );
  }

  const userPrompt = `NARRATIVE: ${query}${topicId !== undefined ? `\nCLUSTER: #${topicId}` : ""}`;

  try {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY ?? "" });

    const result = await streamText({
      model:       groq("llama-3.3-70b-versatile"),
      system:      SYSTEM_PROMPT,
      prompt:      userPrompt,
      maxOutputTokens: 1400,
      temperature: 0.4,
    });

    return result.toTextStreamResponse();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/fingerprint] Groq error:", message);
    return NextResponse.json(
      { error: `Groq API error: ${message}` },
      { status: 502 }
    );
  }
}
