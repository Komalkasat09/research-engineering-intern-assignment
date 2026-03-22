"use client";

/**
 * /fingerprint — Narrative Fingerprint: community reaction simulator.
 *
 * Simulates how 5 Reddit community archetypes would react to a given narrative.
 * Uses Gemini 2.0 Flash streaming via useCompletion().
 *
 * The 5 archetypes:
 *   - Climate Activist (r/ExtinctionRebellion)
 *   - Climate Doomist (r/collapse)
 *   - Tech Optimist (r/Futurology)
 *   - Policy Analyst (r/environment)
 *   - Climate Skeptic (r/climateskeptics)
 */

import { useState, useRef, useCallback } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";

// ── Archetype config ──────────────────────────────────────────────────────────

const ARCHETYPES = [
  { id: "mainstream",   name: "Mainstream political",   color: "#1D9E75", subs: "r/politics" },
  { id: "anarchist",    name: "Anarchist / anti-state", color: "#7F77DD", subs: "r/Anarchism" },
  { id: "technocratic", name: "Technocratic centrist",  color: "#BA7517", subs: "r/neoliberal" },
  { id: "conservative", name: "Conservative / pro-DOGE", color: "#D85A30", subs: "r/Conservative" },
  { id: "democrat",     name: "Institutional Democrat", color: "#378ADD", subs: "r/democrats" },
];

const EXAMPLES = [
  "DOGE just fired 10,000 federal workers overnight",
  "Tariffs on Canada will raise prices for American families",
  "ICE is conducting mass deportations of legal residents",
  "Elon Musk has access to all government payment systems",
  "The courts are blocking DOGE from accessing Treasury data",
];

// ── Parse streaming output into archetype sections ────────────────────────────

interface ArchetypeSection {
  name:      string;
  reaction:  string;
  amplify:   string;
  mutation:  string;
  color:     string;
  subs:      string;
}

function parseCompletion(text: string): {
  archetypes: ArchetypeSection[];
  contagion:  string;
  fracture:   string;
} {
  const archetypes: ArchetypeSection[] = [];

  for (const archetype of ARCHETYPES) {
    // Use [\s\S] instead of . with s flag for ES2017 compat
    const sectionRegex = new RegExp(
      `###\\s*${archetype.name}([\\s\\S]*?)(?=###|CONTAGION|$)`,
      "i"
    );
    const match = text.match(sectionRegex);
    if (!match) continue;

    const section = match[0];

    const reaction = section.match(/REACTION:\s*([\s\S]+?)(?=AMPLIFY|SUPPRESS|MUTATION|$)/i)?.[1]?.trim() ?? "";
    const amplify  = section.match(/(?:AMPLIFY|SUPPRESS)[^:]*:\s*([\s\S]+?)(?=MUTATION|###|CONTAGION|$)/i)?.[1]?.trim() ?? "";
    const mutation = section.match(/MUTATION:\s*([\s\S]+?)(?=###|CONTAGION|$)/i)?.[1]?.trim() ?? "";

    archetypes.push({
      name:     archetype.name,
      subs:     archetype.subs,
      color:    archetype.color,
      reaction,
      amplify,
      mutation,
    });
  }

  const contagion = text.match(/CONTAGION SCORE:\s*([\s\S]+?)(?=FRACTURE|$)/i)?.[1]?.trim() ?? "";
  const fracture  = text.match(/FRACTURE POINT:\s*([\s\S]+?)$/i)?.[1]?.trim() ?? "";

  return { archetypes, contagion, fracture };
}

// ── Archetype card ────────────────────────────────────────────────────────────

function ArchetypeCard({ section }: { section: ArchetypeSection }) {
  const isAmplify = section.amplify.toLowerCase().startsWith("amplify");

  return (
    <div
      style={{
        background:   "#111418",
        border:       `1px solid ${section.color}33`,
        borderRadius: 10,
        overflow:     "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding:      "8px 12px",
          borderBottom: `1px solid ${section.color}22`,
          background:   `${section.color}0d`,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width:        7,
              height:       7,
              borderRadius: "50%",
              background:   section.color,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0" }}>
            {section.name}
          </span>
        </div>
        <span
          style={{
            fontSize:   10,
            color:      section.color,
            fontFamily: "var(--font-mono)",
            opacity:    0.7,
          }}
        >
          {section.subs}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {section.reaction && (
          <div>
            <div style={{ fontSize: 9, color: "#3A4148", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              reaction
            </div>
            <p style={{ fontSize: 12, fontFamily: "var(--font-serif)", color: "#C8D3E0", lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
              {section.reaction}
            </p>
          </div>
        )}

        {section.amplify && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span
              style={{
                padding:      "2px 8px",
                borderRadius: 12,
                background:   isAmplify ? "rgba(29,158,117,0.12)" : "rgba(216,90,48,0.12)",
                border:       `1px solid ${isAmplify ? "rgba(29,158,117,0.3)" : "rgba(216,90,48,0.3)"}`,
                fontSize:     10,
                color:        isAmplify ? "#1D9E75" : "#D85A30",
                fontFamily:   "var(--font-mono)",
                whiteSpace:   "nowrap",
                flexShrink:   0,
              }}
            >
              {isAmplify ? "amplify" : "suppress"}
            </span>
            <span style={{ fontSize: 11, color: "#8A9BB0", lineHeight: 1.5 }}>
              {section.amplify.replace(/^(amplify|suppress)\s*—\s*/i, "")}
            </span>
          </div>
        )}

        {section.mutation && (
          <div>
            <div style={{ fontSize: 9, color: "#3A4148", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
              mutation
            </div>
            <p style={{ fontSize: 11, color: "#8A9BB0", lineHeight: 1.5, margin: 0 }}>
              {section.mutation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FingerprintPage() {
  const { activeTopic } = useSignalStore();
  const [query,       setQuery]       = useState("");
  const [completion,  setCompletion]  = useState("");
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const complete = useCallback(async (q: string) => {
    if (!q.trim() || isLoading) return;
    setCompletion("");
    setError(null);
    setIsLoading(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/fingerprint", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: q, topicId: activeTopic ?? undefined }),
        signal:  abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setCompletion(accumulated);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [activeTopic, isLoading]);

  const parsed = parseCompletion(completion);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    complete(query);
  }

  function handleExample(q: string) {
    setQuery(q);
    complete(q);
  }

  const hasResults = completion.length > 0;

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Narrative fingerprint</span>
        <span className="page-header__meta">
          community reaction simulator · 5 archetypes · Groq · LLaMA 3.3 70B
        </span>
        {activeTopic !== null && (
          <span style={{ fontSize: 11, color: "var(--teal)", fontFamily: "var(--font-mono)", marginLeft: 4 }}>
            · scoped to topic #{activeTopic}
          </span>
        )}
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            { label: "Archetypes",    value: "5",          delta: "community simulations", mono: true },
            { label: "Model",         value: "Groq",       delta: "LLaMA 3.3 70B · temp 0.4", mono: true },
            { label: "Subreddits",    value: "5",          delta: "real community voices",  mono: true },
            { label: "Output",        value: "Streaming",  delta: "token-by-token",         mono: true },
          ]}
        />
      </div>

      <div
        style={{
          flex:          1,
          minHeight:     0,
          margin:        "12px 24px 0",
          display:       "flex",
          flexDirection: "column",
          gap:           10,
          paddingBottom: 16,
          overflowY:     "auto",
        }}
      >
        {/* Input panel */}
        <div
          style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding:      "14px",
            flexShrink:   0,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a narrative or claim to simulate community reactions…"
              disabled={isLoading}
              style={{
                flex:         1,
                background:   "#0D1014",
                border:       "1px solid #1E2530",
                borderRadius: 8,
                padding:      "9px 14px",
                color:        "#E2E8F0",
                fontSize:     13,
                fontFamily:   "var(--font-sans)",
                outline:      "none",
                transition:   "border-color 150ms ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#0F6E56")}
              onBlur={(e)  => (e.target.style.borderColor = "#1E2530")}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              style={{
                padding:      "9px 18px",
                background:   isLoading || !query.trim() ? "transparent" : "rgba(29,158,117,0.15)",
                border:       `1px solid ${isLoading || !query.trim() ? "#1E2530" : "#0F6E56"}`,
                borderRadius: 8,
                color:        isLoading || !query.trim() ? "#3A4148" : "#1D9E75",
                fontSize:     13,
                fontFamily:   "var(--font-sans)",
                cursor:       isLoading || !query.trim() ? "not-allowed" : "pointer",
                whiteSpace:   "nowrap",
                transition:   "all 150ms ease",
              }}
            >
              {isLoading ? "simulating…" : "simulate ↗"}
            </button>
          </form>

          {/* Example narratives */}
          {!hasResults && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "#3A4148", fontFamily: "var(--font-mono)", alignSelf: "center" }}>
                examples:
              </span>
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExample(q)}
                  disabled={isLoading}
                  style={{
                    padding:      "4px 10px",
                    background:   "transparent",
                    border:       "1px solid #1E2530",
                    borderRadius: 20,
                    color:        "#8A9BB0",
                    fontSize:     11,
                    fontFamily:   "var(--font-sans)",
                    cursor:       "pointer",
                    transition:   "all 150ms ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#2A3340";
                    e.currentTarget.style.color       = "#A0AEC0";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#1E2530";
                    e.currentTarget.style.color       = "#8A9BB0";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding:      "8px 12px",
              background:   "rgba(226,75,74,0.1)",
              border:       "1px solid rgba(226,75,74,0.3)",
              borderRadius: 8,
              fontSize:     12,
              color:        "#E24B4A",
              fontFamily:   "var(--font-mono)",
              flexShrink:   0,
            }}
          >
            {error.includes("GOOGLE")
              ? "API key not set. Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local"
              : error}
          </div>
        )}

        {/* Results grid */}
        {hasResults && (
          <>
            {/* Archetype cards */}
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap:                 10,
              }}
            >
              {parsed.archetypes.length > 0
                ? parsed.archetypes.map((section) => (
                    <ArchetypeCard key={section.name} section={section} />
                  ))
                : ARCHETYPES.map((a) => (
                    <div
                      key={a.name}
                      style={{
                        background:   "#111418",
                        border:       `1px solid ${a.color}22`,
                        borderRadius: 10,
                        padding:      "12px",
                        minHeight:    80,
                        display:      "flex",
                        alignItems:   "center",
                        gap:          8,
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, opacity: 0.4 }} />
                      <span style={{ fontSize: 11, color: "#3A4148", fontFamily: "var(--font-mono)" }}>
                        {a.name} — generating…
                      </span>
                    </div>
                  ))}
            </div>

            {/* Contagion + fracture */}
            {(parsed.contagion || parsed.fracture) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                {parsed.contagion && (
                  <div
                    style={{
                      background:   "#111418",
                      border:       "1px solid rgba(29,158,117,0.3)",
                      borderRadius: 10,
                      padding:      "12px 14px",
                    }}
                  >
                    <div style={{ fontSize: 9, color: "#3A4148", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      contagion score
                    </div>
                    <p style={{ fontSize: 13, color: "#C8D3E0", fontFamily: "var(--font-serif)", lineHeight: 1.6, margin: 0 }}>
                      {parsed.contagion}
                    </p>
                  </div>
                )}
                {parsed.fracture && (
                  <div
                    style={{
                      background:   "#111418",
                      border:       "1px solid rgba(216,90,48,0.3)",
                      borderRadius: 10,
                      padding:      "12px 14px",
                    }}
                  >
                    <div style={{ fontSize: 9, color: "#3A4148", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      fracture point
                    </div>
                    <p style={{ fontSize: 13, color: "#C8D3E0", fontFamily: "var(--font-serif)", lineHeight: 1.6, margin: 0 }}>
                      {parsed.fracture}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!hasResults && !isLoading && (
          <div
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              gap:            16,
              padding:        "40px 24px",
            }}
          >
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap:                 8,
                width:               "100%",
                maxWidth:            600,
                opacity:             0.3,
              }}
            >
              {ARCHETYPES.map((a) => (
                <div
                  key={a.name}
                  style={{
                    height:       60,
                    borderRadius: 8,
                    border:       `1px solid ${a.color}44`,
                    background:   `${a.color}08`,
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#3A4148", fontFamily: "var(--font-mono)", textAlign: "center" }}>
              enter a narrative above to simulate community reactions
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
