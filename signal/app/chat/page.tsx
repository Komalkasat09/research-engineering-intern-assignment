// FILE: app/chat/page.tsx
"use client";

/**
 * /chat — Ask Signal: OSINT investigator chatbot page.
 *
 * The AskSignal component handles all the chat UI logic.
 * This page provides the Shell wrapper, header, and context banner.
 *
 * When activeTopic is set (from any other view), the chatbot scopes
 * its retrieval to posts from that cluster only. This is shown in
 * a teal banner below the header.
 *
 * Suggested queries in the empty state are designed to showcase the
 * most analytically interesting capabilities:
 *   - Account-level investigation (who amplified X before it peaked)
 *   - Temporal analysis (how did COP26 vs COP27 language differ)
 *   - Cross-community patterns (which subs first adopted a framing)
 *   - Coordination detection follow-ups
 */

import Shell from "@/components/Shell";
import AskSignal from "@/components/AskSignal";
import { useSignalStore } from "@/lib/store";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ChatPageContent() {
  const { activeTopic, investigationContext } = useSignalStore();
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams.get("q") ?? undefined;
  const prefilledQuery = queryFromUrl ?? (investigationContext
    ? `Investigate ${investigationContext.narrativeName ?? `topic #${investigationContext.topicId ?? "?"}`} from ${investigationContext.originSubreddit ?? "source communities"}.`
    : undefined);

  return (
    <Shell>
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="page-header">
        <span className="page-header__title">Ask Signal</span>
        <span className="page-header__meta">
          OSINT investigator · Groq · LLaMA 3.3 70B · RAG · grounded in real posts
        </span>
        {activeTopic !== null && (
          <span
            style={{
              fontSize:   11,
              color:      "var(--teal)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            · retrieval scoped to topic #{activeTopic}
          </span>
        )}
        {investigationContext?.narrativeName && (
          <span
            style={{
              fontSize: 11,
              color: "var(--coral)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            · context: {investigationContext.narrativeName}
          </span>
        )}
      </div>

      {/* ── Chat component fills remaining height ─────────────────── */}
      {/*
        The outer div must be flex:1 + minHeight:0 + overflow:hidden.
        Without minHeight:0, the flex child ignores the parent's height
        constraint and the chat thread grows past the viewport.
      */}
      <div
        style={{
          flex:      1,
          minHeight: 0,
          overflow:  "hidden",
          display:   "flex",
          flexDirection: "column",
        }}
      >
        <AskSignal initialMessage={prefilledQuery} />
      </div>
    </Shell>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}