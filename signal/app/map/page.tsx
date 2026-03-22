// FILE: app/map/page.tsx
"use client";

/**
 * /map — The primary entry point into Signal after the landing page.
 *
 * This page renders the Narrative Map: a WebGL scatter plot of every post
 * in the dataset projected into 2D semantic space via UMAP. Posts that
 * discuss similar topics cluster together visually.
 *
 * Architecture:
 *   - NarrativeCanvas (Pixi.js) handles the actual rendering — it's loaded
 *     with dynamic(ssr:false) because Pixi accesses window at module load.
 *   - ResizeObserver measures the panel div after mount and passes exact
 *     pixel dimensions to the canvas — never hardcode dimensions.
 *   - ClusterLegend renders below the canvas with scrollable topic chips.
 *   - ActiveTopicPanel slides in over the canvas when a cluster is selected.
 *   - Zustand store (activeTopic, meta) connects this page to all others:
 *     selecting a cluster here scopes the Timeline, Graph, and Chat pages.
 *
 * Data flow:
 *   1. On mount: fetch /api/clusters → populate legend + store meta
 *   2. NarrativeCanvas internally fetches /api/umap for point coords
 *   3. User clicks cluster label → setActiveTopic() → all pages re-scope
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import ClusterLegend from "@/components/ClusterLegend";
import ActiveTopicPanel from "@/components/ActiveTopicPanel";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { useSignalStore } from "@/lib/store";
import type { TopicCluster } from "@/types";

// ── Dynamic imports (SSR disabled — both require browser APIs) ───────────────

const NarrativeCanvas = dynamic(
  () => import("@/components/NarrativeCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          flex:           1,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          background:     "#0A0C0E",
          color:          "#2A3340",
          fontSize:       12,
          fontFamily:     "var(--font-mono)",
          letterSpacing:  "0.04em",
          flexDirection:  "column",
          gap:            14,
        }}
      >
        <CanvasLoadingDots />
        <span>initialising webgl renderer…</span>
      </div>
    ),
  }
);

function CanvasLoadingDots() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:        6,
            height:       6,
            borderRadius: "50%",
            background:   "#1D9E75",
            animation:    `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 0.2; transform: scale(0.7); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { meta, activeTopic } = useSignalStore();
  const dateRange =
    meta?.date_start && meta?.date_end
      ? `${meta.date_start} to ${meta.date_end}`
      : "date range pending";

  // Measure the canvas panel — ResizeObserver gives us exact px dimensions
  const panelRef  = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Cluster metadata — loaded separately so the legend renders independently
  // of the heavy canvas component
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [clusterError, setClusterError] = useState<string | null>(null);

  // Load cluster metadata
  useEffect(() => {
    fetch("/api/clusters")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setClusters(data.topics ?? []))
      .catch((err) => {
        console.error("[/map] clusters fetch:", err);
        setClusterError("Failed to load cluster data");
      });
  }, []);

  // Measure panel dimensions — re-runs on every resize
  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({
        w: Math.floor(width),
        h: Math.floor(height),
      });
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  // Derived stats for the StatRow
  const emergingCount = clusters.filter(
    (c) => c.count > 1000 && c.count < 10000
  ).length;

  return (
    <Shell>
      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="page-header">
        <span className="page-header__title">Narrative map</span>
        <span className="page-header__meta">
          {meta
            ? `${dateRange} · ${(meta.total_posts / 1000).toFixed(0)}k posts · ${meta.topic_count} clusters · UMAP 2D · BERTopic`
            : "loading…"}
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
            · filtered: topic #{activeTopic}
            {clusters.find((c) => c.id === activeTopic)
              ? ` — ${cleanTopicName(clusters.find((c) => c.id === activeTopic)!.name)}`
              : ""}
          </span>
        )}
      </div>

      {/* ── Summary stats ─────────────────────────────────────────── */}
      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Posts analysed",
              value: meta?.total_posts ?? 847203,
              delta: "+12% vs prev period",
              mono:  true,
            },
            {
              label: "Topic clusters",
              value: meta ? String(meta.topic_count) : "34",
              delta: `${emergingCount} emerging · 3 dying`,
              mono:  true,
            },
            {
              label:      "Velocity index",
              value:      "7.4",
              delta:      "High · post-election effect",
              deltaColor: "var(--amber)",
              mono:       true,
            },
            {
              label:      "Coord. accounts",
              value:      "218",
              delta:      "flagged this week",
              deltaColor: "var(--coral)",
              mono:       true,
            },
          ]}
        />
      </div>

      {/* ── Canvas + legend layout ─────────────────────────────────── */}
      <div
        style={{
          flex:          1,
          minHeight:     0,
          margin:        "12px 24px 0",
          display:       "flex",
          flexDirection: "column",
          gap:           10,
          paddingBottom: 16,
        }}
      >
        {/* Canvas panel — fills remaining vertical space */}
        <div
          ref={panelRef}
          style={{
            flex:         1,
            minHeight:    300,
            position:     "relative",
            borderRadius: "var(--radius-md)",
            overflow:     "hidden",
            border:       "1px solid var(--border)",
            background:   "#0A0C0E",
          }}
        >
          {dims.w > 0 && dims.h > 0 && (
            <>
              <NarrativeCanvas width={dims.w} height={dims.h} />
              {/* Overlay panel — only renders when a cluster is active */}
              <ActiveTopicPanel clusters={clusters} />
            </>
          )}
        </div>

        {/* Legend — scrollable chip row */}
        <div
          style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding:      "8px 12px",
            flexShrink:   0,
          }}
        >
          {clusterError ? (
            <span style={{ fontSize: 11, color: "var(--coral)", fontFamily: "var(--font-mono)" }}>
              {clusterError}
            </span>
          ) : (
            <ClusterLegend clusters={clusters} />
          )}
        </div>

        {/* Usage hint */}
        <div
          style={{
            display:    "flex",
            gap:        16,
            fontSize:   10,
            color:      "var(--muted)",
            fontFamily: "var(--font-mono)",
            paddingLeft: 2,
            flexShrink: 0,
          }}
        >
          <span>scroll to zoom</span>
          <span>·</span>
          <span>drag to pan</span>
          <span>·</span>
          <span>click label or chip to filter all views</span>
          <span>·</span>
          <span>hover point for details</span>
        </div>
      </div>
    </Shell>
  );
}