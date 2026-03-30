"use client";

/**
 * ActiveTopicPanel.tsx — Slide-in overlay panel for the selected cluster.
 *
 * Appears as an absolute-positioned panel over the NarrativeCanvas when
 * activeTopic is set. Shows cluster name, top words, post count, and
 * quick-action links to other views filtered to this topic.
 */

import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { useRouter } from "next/navigation";
import type { TopicCluster } from "@/types";

interface Props {
  clusters: TopicCluster[];
}

export default function ActiveTopicPanel({ clusters }: Props) {
  const { activeTopic, setActiveTopic } = useSignalStore();
  const router = useRouter();

  if (activeTopic === null) return null;

  const cluster = clusters.find((c) => c.id === activeTopic);
  if (!cluster) return null;

  return (
    <div
      style={{
        position:     "absolute",
        top:          12,
        right:        12,
        width:        "min(220px, calc(100% - 24px))",
        maxHeight:    "calc(100% - 24px)",
        background:   "#111418",
        border:       `1px solid ${cluster.color}44`,
        borderRadius: 10,
        overflowX:    "hidden",
        overflowY:    "auto",
        zIndex:       20,
        animation:    "slideIn 0.18s ease",
        boxShadow:    `0 0 24px ${cluster.color}18`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding:      "10px 12px",
          borderBottom: "1px solid #1E2530",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          background:   `${cluster.color}0d`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width:        8,
              height:       8,
              borderRadius: "50%",
              background:   cluster.color,
              flexShrink:   0,
            }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0" }}>
              {cleanTopicName(cluster.name)}
            </div>
            <div
              style={{
                fontSize:   9,
                color:      "#4A5568",
                fontFamily: "var(--font-mono)",
                marginTop:  1,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              topic #{cluster.id}
            </div>
          </div>
        </div>
        <button
          onClick={() => setActiveTopic(null)}
          aria-label="Clear topic filter"
          style={{
            background: "none",
            border:     "none",
            color:      "#4A5568",
            cursor:     "pointer",
            fontSize:   16,
            lineHeight: 1,
            padding:    "2px 4px",
          }}
        >
          ×
        </button>
      </div>

      {/* Stats */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #0D1014" }}>
        <div style={{ fontSize: 9, color: "#3A4148", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
          posts
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, color: "#E2E8F0", fontFamily: "var(--font-mono)" }}>
          {cluster.count.toLocaleString()}
        </div>
      </div>

      {/* Top words */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #0D1014" }}>
        <div
          style={{
            fontSize:      9,
            color:         "#3A4148",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom:  6,
          }}
        >
          top terms
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {cluster.top_words.slice(0, 6).map((word) => (
            <span
              key={word}
              style={{
                padding:      "2px 7px",
                borderRadius: 12,
                background:   `${cluster.color}18`,
                border:       `1px solid ${cluster.color}33`,
                fontSize:     10,
                color:        cluster.color,
                fontFamily:   "var(--font-mono)",
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { label: "view posts →",      path: `/posts?topic_id=${cluster.id}` },
          { label: "view timeline →",   path: "/timeline" },
          { label: "view stance →",     path: "/stance" },
          { label: "ask Signal →",      path: "/chat" },
        ].map((link) => (
          <button
            key={link.path}
            onClick={() => router.push(link.path)}
            style={{
              width:        "100%",
              padding:      "5px 0",
              background:   "transparent",
              border:       "1px solid #1E2530",
              borderRadius: 6,
              color:        "#8A9BB0",
              fontSize:     11,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              textAlign:    "center",
              transition:   "all 150ms ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = cluster.color + "55";
              e.currentTarget.style.color       = cluster.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#1E2530";
              e.currentTarget.style.color       = "#8A9BB0";
            }}
          >
            {link.label}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
