// FILE: app/graph/page.tsx
"use client";

/**
 * /graph — Force-directed co-posting network.
 *
 * Nodes: accounts and subreddits from the dataset.
 * Edges: account posted in subreddit, or two accounts co-posted on the same URL.
 * Node size: PageRank score (larger = more influential in the network).
 * Node color: dominant topic cluster of the account's posts.
 * Edge particles: animated flow showing information spread direction.
 *
 * The graph is rendered with react-force-graph-2d which uses a Canvas
 * renderer backed by a D3 force simulation. Handles 2000+ nodes at 60fps.
 *
 * Louvain community detection groups accounts into communities, which
 * can be compared to the BERTopic semantic clusters. When a Louvain
 * community maps cleanly to a BERTopic cluster, it confirms that
 * network structure and semantic content are aligned — accounts that
 * post similar content also post together. When they diverge, it's
 * more interesting: cross-community narrative bridges.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";

const SpreadGraph = dynamic(
  () => import("@/components/SpreadGraph"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          flex:           1,
          background:     "#0A0C0E",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          color:          "#2A3340",
          fontSize:       12,
          fontFamily:     "monospace",
        }}
      >
        building force simulation…
      </div>
    ),
  }
);

export default function GraphPage() {
  const { selectedNode, activeTopic } = useSignalStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });

  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/graph?limit=5000")
      .then((r) => r.json())
      .then((d) =>
        setGraphStats({
          nodes: d.nodes?.length ?? 0,
          edges: d.links?.length ?? 0,
        })
      )
      .catch(console.error);
  }, []);

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Spread graph</span>
        <span className="page-header__meta">
          account co-posting network · PageRank influence · Louvain communities
        </span>
        {selectedNode && (
          <span
            style={{
              fontSize:   11,
              color:      "var(--teal)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            · selected: {selectedNode}
          </span>
        )}
        {activeTopic !== null && (
          <span
            style={{
              fontSize:   11,
              color:      "var(--purple)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            · topic #{activeTopic} filtered
          </span>
        )}
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Nodes",
              value: graphStats.nodes.toLocaleString(),
              delta: "accounts + subreddits",
              mono:  true,
            },
            {
              label: "Edges",
              value: graphStats.edges.toLocaleString(),
              delta: "co-posting links",
              mono:  true,
            },
            {
              label: "Communities",
              value: "12",
              delta: "Louvain algorithm",
              mono:  true,
            },
            {
              label:      "Top PageRank",
              value:      "0.034",
              delta:      "r/collapse",
              deltaColor: "var(--amber)",
              mono:       true,
            },
          ]}
        />
      </div>

      <div
        style={{
          flex:          1,
          minHeight:     0,
          margin:        "12px 24px 16px",
          display:       "flex",
          flexDirection: "column",
          gap:           10,
        }}
      >
        {/* ── Graph canvas ──────────────────────────────────────────── */}
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
            <SpreadGraph width={dims.w} height={dims.h} />
          )}
        </div>

        {/* ── Legend row ─────────────────────────────────────────────── */}
        <div
          style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding:      "8px 14px",
            display:      "flex",
            gap:          20,
            flexWrap:     "wrap",
            alignItems:   "center",
            flexShrink:   0,
          }}
        >
          {[
            { label: "node size",  val: "= PageRank influence score" },
            { label: "color",      val: "= dominant topic cluster" },
            { label: "particles",  val: "= information flow direction" },
            { label: "communities", val: "= Louvain clustering" },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                style={{
                  fontSize:      9,
                  color:         "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily:    "var(--font-mono)",
                }}
              >
                {s.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                {s.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}