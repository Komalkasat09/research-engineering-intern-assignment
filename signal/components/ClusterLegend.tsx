// FILE: components/ClusterLegend.tsx
"use client";

/**
 * ClusterLegend.tsx — Scrollable topic chip row below the narrative map canvas.
 *
 * Each chip shows: color dot · topic name · post count
 * Clicking a chip sets activeTopic in Zustand, which:
 *   - dims non-matching points on the UMAP canvas
 *   - filters the timeline velocity chart
 *   - scopes the force-directed graph
 *   - scopes the Ask Signal chatbot retrieval
 *
 * The "all topics" chip clears the filter (sets activeTopic = null).
 *
 * The chip row uses overflow-x:auto with hidden scrollbar — it scrolls
 * horizontally on narrow screens without taking up vertical space.
 * The topic title attribute shows the top_words as a hover tooltip.
 */

import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { fmtCount } from "@/lib/utils";
import type { TopicCluster } from "@/types";

interface Props {
  clusters: TopicCluster[];
}

export default function ClusterLegend({ clusters }: Props) {
  const { activeTopic, setActiveTopic } = useSignalStore();

  // Sort by count descending — most prominent topics first
  const sorted = [...clusters]
    .filter((c) => c.id !== -1)
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    return (
      <div
        style={{
          fontSize:   11,
          color:      "var(--muted)",
          fontFamily: "var(--font-mono)",
          padding:    "2px 0",
        }}
      >
        loading clusters…
      </div>
    );
  }

  return (
    <div
      style={{
        display:        "flex",
        gap:            6,
        overflowX:      "auto",
        paddingBottom:  4,
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* All topics chip */}
      <button
        onClick={() => setActiveTopic(null)}
        aria-label="Show all topics"
        aria-pressed={activeTopic === null}
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          5,
          padding:      "4px 10px",
          borderRadius: 20,
          border:       `1px solid ${activeTopic === null ? "#0F6E56" : "#2A3340"}`,
          background:   activeTopic === null ? "rgba(29,158,117,0.12)" : "transparent",
          color:        activeTopic === null ? "#1D9E75" : "#8A9BB0",
          fontSize:     11,
          fontFamily:   "var(--font-sans)",
          cursor:       "pointer",
          whiteSpace:   "nowrap",
          transition:   "all 150ms ease",
          flexShrink:   0,
        }}
      >
        all topics
      </button>

      {/* Per-topic chips */}
      {sorted.map((cluster) => {
        const isActive = activeTopic === cluster.id;
        const displayName = cleanTopicName(cluster.name);
        return (
          <button
            key={cluster.id}
            onClick={() => setActiveTopic(isActive ? null : cluster.id)}
            aria-label={`Filter to ${displayName}`}
            aria-pressed={isActive}
            title={`Top terms: ${cluster.top_words.slice(0, 5).join(", ")}`}
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          6,
              padding:      "4px 10px",
              borderRadius: 20,
              border:       `1px solid ${isActive ? cluster.color + "88" : "#2A3340"}`,
              background:   isActive ? cluster.color + "1a" : "transparent",
              color:        isActive ? cluster.color : "#8A9BB0",
              fontSize:     11,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              transition:   "all 150ms ease",
              flexShrink:   0,
            }}
            onMouseOver={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = cluster.color + "44";
                e.currentTarget.style.color       = cluster.color + "aa";
              }
            }}
            onMouseOut={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "#2A3340";
                e.currentTarget.style.color       = "#8A9BB0";
              }
            }}
          >
            {/* Color dot */}
            <span
              style={{
                width:        6,
                height:       6,
                borderRadius: "50%",
                background:   cluster.color,
                flexShrink:   0,
              }}
            />
            {displayName}
            <span
              style={{
                fontSize:   10,
                color:      isActive ? cluster.color + "aa" : "#3A4148",
                fontFamily: "var(--font-mono)",
              }}
            >
              {fmtCount(cluster.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}