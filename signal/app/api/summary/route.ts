import { NextResponse } from "next/server";
import { getGroqApiKeys, withGroqKeyRotation } from "@/lib/groqRotator";

export const maxDuration = 30;

const SUMMARY_MODEL_CANDIDATES = [
  process.env.GROQ_MODEL_SUMMARY,
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
].filter((m): m is string => Boolean(m && m.trim()));

function isModelDecommissionedError(status: number, body: string): boolean {
  if (status !== 400) return false;
  const text = body.toLowerCase();
  return text.includes("model_decommissioned") || text.includes("decommissioned");
}

export async function POST(req: Request) {
  let context = "";
  let prompt = "";

  try {
    const body = await req.json();
    context = String(body?.context ?? "").trim();
    prompt = String(body?.prompt ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!context || !prompt) {
    return NextResponse.json(
      { error: "Both context and prompt are required" },
      { status: 400 }
    );
  }

  if (!getGroqApiKeys().length) {
    return NextResponse.json(
      { error: "GROQ_API_KEY not configured" },
      { status: 500 }
    );
  }

  const system = [
    "You are Signal, a clear and concise narrative intelligence analyst.",
    "Write exactly 2 sentences in plain language for non-technical readers.",
    "Ground statements in the provided metrics and avoid jargon.",
  ].join(" ");

  try {
    const summary = await withGroqKeyRotation(async (apiKey) => {
      let lastError = "";

      for (let i = 0; i < SUMMARY_MODEL_CANDIDATES.length; i++) {
        const model = SUMMARY_MODEL_CANDIDATES[i]!;
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: `Context:\n${context}\n\nTask:\n${prompt}` },
            ],
            temperature: 0.2,
            max_tokens: 220,
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

        const hasFallback = i < SUMMARY_MODEL_CANDIDATES.length - 1;
        if (hasFallback && isModelDecommissionedError(response.status, errData)) {
          continue;
        }

        throw new Error(lastError);
      }

      throw new Error(lastError || "Groq API error: No model candidates succeeded");
    });

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/summary]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
