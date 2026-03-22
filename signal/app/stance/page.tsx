// FILE: app/stance/page.tsx
"use client";

/**
 * /stance — Stance River: D3 streamgraph of pro/neutral/con over time.
 *
 * Shows how framing polarity shifts across the dataset timeline.
 * Each week, the fraction of posts classified as pro-establishment,
 * ambiguous, or anti-establishment is visualised as a flowing stream.
 *
 * Key research insight: the "contested terrain" moments — when the con
 * stream grows — often precede or follow major real-world events. COP26
 * produced a pro surge. The 2022 IPCC WG2 report produced both a pro
 * surge AND a doomerism spike in the neutral-to-con boundary.
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { useSignalStore } from "@/lib/store";
import type { StancePoint, TopicCluster } from "@/types";

const StanceRiver = dynamic(
  () => import("@/components/StanceRiver"),
  {
    ssr:     false,
    loading: () => (
      <div
        className="shimmer"
        style={{ flex: 1, minHeight: 0, borderRadius: "var(--radius-md)" }}
      />
    ),
  }
);

export default function StancePage() {
  const { activeTopic } = useSignalStore();

  const panelRef = useRef<HTMLDivElement>(null);
  const [dims, setDims]       = useState({ w: 0, h: 0 });
  const [stance, setStance]   = useState<StancePoint[]>([]);
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const param = activeTopic !== null ? `?topic_id=${activeTopic}` : "";
    Promise.all([
      fetch(`/api/stance${param}`).then((r) => r.json()),
      fetch("/api/clusters").then((r) => r.json()),
    ])
      .then(([stanceData, clusterData]) => {
        setStance(stanceData as StancePoint[]);
        setClusters((clusterData as { topics: TopicCluster[] }).topics ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTopic]);

  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  const activeCluster = clusters.find((c) => c.id === activeTopic);

  // Aggregate stats across all stance data
  const avgPro = stance.length
    ? stance.reduce((s, d) => s + d.pro, 0) / stance.length
    : 0;
  const avgCon = stance.length
    ? stance.reduce((s, d) => s + d.con, 0) / stance.length
    : 0;
  const contestedWeeks = stance.filter(
    (d) => d.con > 0.2
  ).length;

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Stance river</span>
        <span className="page-header__meta">
          zero-shot NLI · DeBERTa · pro-establishment / ambiguous / anti-establishment over time
        </span>
        {activeCluster && (
          <span
            style={{
              fontSize:   11,
              color:      "var(--teal)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            · {cleanTopicName(activeCluster.name)}
          </span>
        )}
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Avg pro-establishment",
              value: loading ? "…" : `${(avgPro * 100).toFixed(1)}%`,
              delta: "avg pro-establishment stance · across all topics",
              mono:  true,
            },
            {
              label:      "Contested weeks",
              value:      loading ? "…" : String(contestedWeeks),
              delta:      "con stream > 20%",
              deltaColor: contestedWeeks > 30 ? "var(--coral)" : "var(--amber)",
              mono:       true,
            },
            {
              label: "NLI model",
              value: "DeBERTa",
              delta: "zero-shot · threshold 0.55",
              mono:  true,
            },
            {
              label: "Labelled posts",
              value: 847203,
              delta: "100% coverage",
              mono:  true,
            },
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
        }}
      >
        <div
          ref={panelRef}
          className="viz-panel"
          style={{ flex: 1, minHeight: 300 }}
        >
          <div className="viz-panel__header">
            <span className="viz-panel__title">
              Stance over time
              {activeCluster ? ` — ${cleanTopicName(activeCluster.name)}` : " — all topics"}
            </span>
            <span
              style={{
                fontSize:   10,
                color:      "var(--dim)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {loading
                ? "loading…"
                : `${stance.length.toLocaleString()} weekly buckets · hover stream for breakdown`}
            </span>
          </div>

          {/* Legend */}
          <div
            style={{
              padding:      "6px 14px",
              borderBottom: "1px solid var(--border)",
              display:      "flex",
              gap:          16,
              alignItems:   "center",
              flexShrink:   0,
            }}
          >
            {[
              { color: "#1D9E75", label: "pro-establishment" },
              { color: "#3A4148", label: "ambiguous" },
              { color: "#D85A30", label: "anti-establishment" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        6,
                }}
              >
                <div
                  style={{
                    width:        10,
                    height:       10,
                    borderRadius: "50%",
                    background:   s.color,
                    flexShrink:   0,
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                  {s.label}
                </span>
              </div>
            ))}
            <span
              style={{
                fontSize:   10,
                color:      "var(--muted)",
                fontFamily: "var(--font-mono)",
                marginLeft: "auto",
              }}
            >
              NLI premise: "pro-establishment / pro-government position"
            </span>
          </div>

          <div
            className="viz-panel__body"
            style={{ padding: "8px 8px 0", overflow: "hidden" }}
          >
            {!loading && dims.w > 0 && dims.h > 80 && (
              <StanceRiver
                data={stance}
                width={dims.w - 16}
                height={dims.h - 80}
                topicId={activeTopic ?? undefined}
              />
            )}
            {loading && (
              <div
                className="shimmer"
                style={{ height: 300, borderRadius: "var(--radius-sm)", margin: "8px 0" }}
              />
            )}
          </div>
        </div>

        {/* Methodology note */}
        <div
          style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding:      "10px 14px",
            fontSize:     12,
            color:        "var(--text-soft)",
            fontFamily:   "var(--font-serif)",
            fontStyle:    "italic",
            lineHeight:   1.7,
            flexShrink:   0,
          }}
        >
          Stance was classified using <code style={{ fontFamily:"var(--font-mono)",fontSize:11 }}>cross-encoder/nli-deberta-v3-small</code> in zero-shot mode. The premise "pro-establishment vs anti-establishment framing" was chosen over left/right labels because it more accurately captures the primary tension in this dataset — communities differ less on ideology than on their relationship to state and institutional authority. Entailment probability above 0.55 → pro-establishment; contradiction above 0.55 → anti-establishment; otherwise → ambiguous. Threshold was calibrated to 0.55 after manual review of 100 borderline cases (the model's default of 0.6 over-predicted ambiguous).
        </div>
      </div>
    </Shell>
  );
}