"use client";

/**
 * TopicLegendBar.tsx — Compact topic chip row for the timeline page.
 *
 * Shows which topics are present in the current velocity data.
 * Clicking a chip sets activeTopic in Zustand.
 */

import { useSignalStore } from "@/lib/store";
import type { VelocityPoint } from "@/types";

interface Props {
  topicColors: Record<number, string>;
  topicNames:  Record<number, string>;
  data:        VelocityPoint[];
}

export default function TopicLegendBar({ topicColors, topicNames, data }: Props) {
  const { activeTopic, setActiveTopic } = useSignalStore();

  // Unique topic IDs present in the data
  const topicIds = Array.from(new Set(data.map((d) => d.topic_id))).sort(
    (a, b) => a - b
  );

  if (topicIds.length === 0) return null;

  return (
    <div
      style={{
        display:        "flex",
        gap:            6,
        flexWrap:       "wrap",
        alignItems:     "center",
      }}
    >
      <span
        style={{
          fontSize:      9,
          color:         "#3A4148",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily:    "var(--font-mono)",
          flexShrink:    0,
        }}
      >
        topics
      </span>

      {/* All chip */}
      <button
        onClick={() => setActiveTopic(null)}
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          5,
          padding:      "3px 9px",
          borderRadius: 20,
          border:       `1px solid ${activeTopic === null ? "#0F6E56" : "#2A3340"}`,
          background:   activeTopic === null ? "rgba(29,158,117,0.12)" : "transparent",
          color:        activeTopic === null ? "#1D9E75" : "#8A9BB0",
          fontSize:     10,
          fontFamily:   "var(--font-sans)",
          cursor:       "pointer",
          whiteSpace:   "nowrap",
          transition:   "all 150ms ease",
        }}
      >
        all
      </button>

      {topicIds.map((id) => {
        const color    = topicColors[id] ?? "#3A4148";
        const name     = topicNames[id]  ?? `topic ${id}`;
        const isActive = activeTopic === id;

        return (
          <button
            key={id}
            onClick={() => setActiveTopic(isActive ? null : id)}
            title={name}
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          5,
              padding:      "3px 9px",
              borderRadius: 20,
              border:       `1px solid ${isActive ? color + "88" : "#2A3340"}`,
              background:   isActive ? color + "1a" : "transparent",
              color:        isActive ? color : "#8A9BB0",
              fontSize:     10,
              fontFamily:   "var(--font-sans)",
              cursor:       "pointer",
              whiteSpace:   "nowrap",
              transition:   "all 150ms ease",
            }}
            onMouseOver={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = color + "44";
                e.currentTarget.style.color       = color + "aa";
              }
            }}
            onMouseOut={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = "#2A3340";
                e.currentTarget.style.color       = "#8A9BB0";
              }
            }}
          >
            <span
              style={{
                width:        5,
                height:       5,
                borderRadius: "50%",
                background:   color,
                flexShrink:   0,
              }}
            />
            {name}
          </button>
        );
      })}
    </div>
  );
}
