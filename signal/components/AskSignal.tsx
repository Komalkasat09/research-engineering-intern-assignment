"use client";

/**
 * AskSignal.tsx — Streaming OSINT investigator chatbot.
 *
 * Uses native fetch + ReadableStream for token-by-token streaming
 * (Vercel AI SDK v6 removed useChat/useCompletion hooks).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSignalStore } from "@/lib/store";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id:      string;
  role:    "user" | "assistant";
  content: string;
}

// ── Suggested starter queries ─────────────────────────────────────────────────
const SUGGESTED_QUERIES = [
  "Which accounts were amplifying Musk/DOGE content before it peaked?",
  "How did the language around immigration shift after the election?",
  "Which subreddits first adopted anti-DOGE framing?",
  "Are there accounts posting across both r/Anarchism and r/neoliberal?",
  "What narratives dominated r/politics in January 2025?",
  "Which topics show the highest narrative velocity and why?",
];

// ── Message bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  role:    "user" | "assistant";
  content: string;
  isLast:  boolean;
  isStreaming: boolean;
}

function MessageBubble({ role, content, isLast, isStreaming }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div
          style={{
            maxWidth:     "72%",
            background:   "#161B21",
            border:       "1px solid #1E2530",
            borderRadius: "12px 12px 2px 12px",
            padding:      "8px 14px",
            fontSize:     13,
            fontFamily:   "var(--font-mono)",
            color:        "#A0AEC0",
            lineHeight:   1.6,
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  const followupIdx = content.indexOf("Follow-up angles:");
  const mainContent = followupIdx > -1 ? content.slice(0, followupIdx).trim() : content;
  const followups   = followupIdx > -1 ? content.slice(followupIdx).trim() : null;

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 500, color: "#1D9E75", flexShrink: 0,
          }}
        >
          S
        </div>
        <span style={{ fontSize: 10, color: "#4A5568", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
          signal · osint analysis
        </span>
      </div>

      {/* Main analysis */}
      <div
        style={{ fontSize: 13, fontFamily: "var(--font-serif)", color: "#C8D3E0", lineHeight: 1.75, paddingLeft: 30 }}
        dangerouslySetInnerHTML={{ __html: formatAnalysis(mainContent) }}
      />

      {/* Follow-up angles */}
      {followups && (
        <div style={{ marginTop: 10, paddingLeft: 30, borderLeft: "2px solid #1D9E75", paddingTop: 6, paddingBottom: 6 }}>
          <div style={{ fontSize: 10, color: "#1D9E75", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Follow-up angles
          </div>
          <div
            style={{ fontSize: 12, fontFamily: "var(--font-serif)", color: "#8A9BB0", lineHeight: 1.7, fontStyle: "italic" }}
            dangerouslySetInnerHTML={{ __html: formatAnalysis(followups.replace("Follow-up angles:", "").trim()) }}
          />
        </div>
      )}

      {/* Streaming cursor */}
      {isLast && isStreaming && (
        <div style={{ paddingLeft: 30, marginTop: 4, display: "flex", gap: 3, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 4, height: 4, borderRadius: "50%", background: "#1D9E75", opacity: 0.6,
                animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatAnalysis(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#E2E8F0;font-weight:500'>$1</strong>")
    .replace(
      /\[post_(\w+)\]/g,
      "<span style='font-family:var(--font-mono);font-size:11px;color:#1D9E75;background:rgba(29,158,117,0.1);padding:1px 5px;border-radius:4px;'>[post_$1]</span>"
    )
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onSuggest }: { onSuggest: (q: string) => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "32px 24px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.04em", color: "#2A3340", marginBottom: 6 }}>
          signal<span style={{ color: "#1D9E75" }}>.</span>
        </div>
        <div style={{ fontSize: 12, color: "#3A4148", fontFamily: "var(--font-mono)" }}>
          ask an investigative question about the data
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 640 }}>
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => onSuggest(q)}
            style={{
              padding: "10px 12px", background: "transparent", border: "1px solid #1E2530",
              borderRadius: 8, color: "#8A9BB0", fontSize: 12, fontFamily: "var(--font-sans)",
              textAlign: "left", cursor: "pointer", lineHeight: 1.5, transition: "all 150ms ease",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#2A3340"; e.currentTarget.style.color = "#A0AEC0"; e.currentTarget.style.background = "#0D1014"; }}
            onMouseOut={(e)  => { e.currentTarget.style.borderColor = "#1E2530"; e.currentTarget.style.color = "#8A9BB0"; e.currentTarget.style.background = "transparent"; }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialMessage?: string;
}

export default function AskSignal({ initialMessage }: Props) {
  const { activeTopic } = useSignalStore();
  const bottomRef       = useRef<HTMLDivElement>(null);
  const abortRef        = useRef<AbortController | null>(null);

  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState("");
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!initialMessage) return;
    setInput(initialMessage);
  }, [initialMessage]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    const assistantId = (Date.now() + 1).toString();

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setIsLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          messages:    [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          activeTopic,
        }),
        signal: abortRef.current.signal,
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
        const current = accumulated;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m))
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  }, [messages, activeTopic, isLoading]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
    setInput("");
  }

  function handleSuggest(query: string) {
    setInput(query);
    setTimeout(() => {
      sendMessage(query);
      setInput("");
    }, 50);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Active topic banner */}
      {activeTopic !== null && (
        <div style={{ padding: "6px 20px", borderBottom: "1px solid #1E2530", background: "rgba(29,158,117,0.06)", fontSize: 11, color: "#1D9E75", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1D9E75" }} />
          scoped to topic #{activeTopic} — retrieval filtered to this cluster
        </div>
      )}

      {/* Message thread */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: messages.length > 0 ? "20px 20px 0" : 0, display: "flex", flexDirection: "column" }}>
        {messages.length === 0 ? (
          <EmptyState onSuggest={handleSuggest} />
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                isLast={i === messages.length - 1}
                isStreaming={isLoading && i === messages.length - 1}
              />
            ))}
            {/* Waiting for first token */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div style={{ paddingLeft: 30, marginBottom: 12, display: "flex", gap: 4, alignItems: "center" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#1D9E75", marginRight: 6, flexShrink: 0 }}>
                  S
                </div>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#1D9E75", opacity: 0.5, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} style={{ height: 8 }} />
          </>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: "0 20px 8px", padding: "8px 12px", background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.3)", borderRadius: 8, fontSize: 12, color: "#E24B4A", fontFamily: "var(--font-mono)", flexShrink: 0 }}>
          {error.includes("GROQ")
            ? "API key not set. Add GROQ_API_KEY to .env.local — get a free key at console.groq.com"
            : error}
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #1E2530", flexShrink: 0 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask an investigative question about the narrative data…"
            rows={2}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            style={{
              flex: 1, background: "#0D1014", border: "1px solid #1E2530", borderRadius: 10,
              padding: "10px 14px", color: "#E2E8F0", fontSize: 13, fontFamily: "var(--font-sans)",
              resize: "none", outline: "none", lineHeight: 1.5, transition: "border-color 150ms ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#0F6E56")}
            onBlur={(e)  => (e.target.style.borderColor = "#1E2530")}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: "10px 16px",
              background:   isLoading || !input.trim() ? "transparent" : "rgba(29,158,117,0.15)",
              border:       `1px solid ${isLoading || !input.trim() ? "#1E2530" : "#0F6E56"}`,
              borderRadius: 10,
              color:        isLoading || !input.trim() ? "#3A4148" : "#1D9E75",
              fontSize: 13, fontFamily: "var(--font-sans)",
              cursor:   isLoading || !input.trim() ? "not-allowed" : "pointer",
              transition: "all 150ms ease", whiteSpace: "nowrap", alignSelf: "stretch",
            }}
          >
            {isLoading ? "…" : "analyse ↗"}
          </button>
        </form>

        <div style={{ marginTop: 6, fontSize: 10, color: "#2A3340", fontFamily: "var(--font-mono)" }}>
          enter to send · shift+enter for new line ·{" "}
          {activeTopic !== null ? `scoped to topic #${activeTopic}` : "all topics · select a cluster to scope retrieval"}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
