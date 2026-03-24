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

interface BlindSpotExample {
  post_id: string;
  subreddit: string;
  author: string;
  score: number;
  date: string;
  text: string;
  bucket: "pro_leaning_subreddit" | "anti_leaning_subreddit" | "ambiguous_style";
}

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
  const [hydrated, setHydrated] = useState(false);
  const [stance, setStance]   = useState<StancePoint[]>([]);
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [blindSpots, setBlindSpots] = useState<BlindSpotExample[]>([]);
  const [viewMode, setViewMode] = useState<"executive" | "advanced">("executive");
  const [loading, setLoading] = useState(true);
  const effectiveActiveTopic = hydrated ? activeTopic : null;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const param = effectiveActiveTopic !== null ? `?topic_id=${effectiveActiveTopic}` : "";
    Promise.all([
      fetch(`/api/stance${param}`).then((r) => r.json()),
      fetch("/api/clusters").then((r) => r.json()),
      fetch("/api/stance/examples").then((r) => r.json()).catch(() => ({ examples: [] })),
    ])
      .then(([stanceData, clusterData, exampleData]) => {
        setStance(stanceData as StancePoint[]);
        setClusters((clusterData as { topics: TopicCluster[] }).topics ?? []);
        setBlindSpots((exampleData as { examples?: BlindSpotExample[] }).examples ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [effectiveActiveTopic]);

  useEffect(() => {
    if (!hydrated || viewMode !== "advanced" || !panelRef.current) return;

    const node = panelRef.current;
    const rect = node.getBoundingClientRect();
    setDims({ w: Math.floor(rect.width), h: Math.floor(rect.height) });

    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [hydrated, viewMode]);

  const activeCluster = clusters.find((c) => c.id === effectiveActiveTopic);

  // Aggregate stats across all stance data
  const contestedWeeks = stance.filter(
    (d) => d.con > 0.2
  ).length;
  const avgPro = stance.length ? (stance.reduce((sum, d) => sum + d.pro, 0) / stance.length) * 100 : 0;
  const avgAmbiguous = stance.length ? (stance.reduce((sum, d) => sum + d.neutral, 0) / stance.length) * 100 : 0;
  const avgAnti = stance.length ? (stance.reduce((sum, d) => sum + d.con, 0) / stance.length) * 100 : 0;
  const weeklyBuckets = stance.length;

  const bucketMeta: Record<BlindSpotExample["bucket"], { label: string; tone: string; color: string }> = {
    pro_leaning_subreddit: { label: "pro-establishment", tone: "entailment-aligned", color: "#1D9E75" },
    anti_leaning_subreddit: { label: "anti-establishment", tone: "contradiction-aligned", color: "#D85A30" },
    ambiguous_style: { label: "ambiguous", tone: "implicit framing", color: "#3A4148" },
  };

  const executiveExamples = [
    blindSpots.find((b) => b.bucket === "pro_leaning_subreddit"),
    blindSpots.find((b) => b.bucket === "anti_leaning_subreddit"),
    blindSpots.find((b) => b.bucket === "ambiguous_style"),
  ].filter(Boolean) as BlindSpotExample[];

  let plainTakeaway = "Most posts are implicitly framed, not explicitly pro/anti; explicit stance appears in a smaller share.";
  if (avgAnti > avgPro + 5) {
    plainTakeaway = "Most posts are implicit, and when explicit stance appears it skews anti-establishment in this period.";
  } else if (avgPro > avgAnti + 5) {
    plainTakeaway = "Most posts are implicit, and when explicit stance appears it skews pro-establishment in this period.";
  }

  // Keep first server/client paint deterministic, then render interactive UI.
  if (!hydrated) {
    return (
      <Shell>
        <div className="page-header">
          <span className="page-header__title">Stance river</span>
          <span className="page-header__meta">
            zero-shot NLI · DeBERTa · pro-establishment / ambiguous / anti-establishment over time
          </span>
        </div>
        <div style={{ padding: "12px 24px" }}>
          <div className="shimmer" style={{ height: 260, borderRadius: "var(--radius-md)" }} />
        </div>
      </Shell>
    );
  }

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "rgba(29,158,117,0.06)",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flex: 1,
            }}
          >
            <span style={{ fontSize: 10, color: "var(--teal)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Quick takeaway
            </span>
            <span style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5 }}>
              {loading ? "Preparing stance summary..." : plainTakeaway}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className={`chip ${viewMode === "executive" ? "active" : ""}`}
              onClick={() => setViewMode("executive")}
              style={{ border: "none", cursor: "pointer" }}
            >
              Executive view
            </button>
            <button
              className={`chip ${viewMode === "advanced" ? "active" : ""}`}
              onClick={() => setViewMode("advanced")}
              style={{ border: "none", cursor: "pointer" }}
            >
              Advanced view
            </button>
          </div>
        </div>

        <StatRow
          stats={[
            {
              label: "Avg pro-establishment share",
              value: loading ? "…" : `${Math.round(avgPro)}%`,
              delta: "weekly average",
              mono:  true,
            },
            {
              label: "Contested weeks (anti > 20%)",
              value: loading ? "…" : String(contestedWeeks),
              delta: "weeks with stronger anti framing",
              deltaColor: contestedWeeks > 30 ? "var(--coral)" : "var(--amber)",
              mono: true,
            },
            {
              label: "Ambiguous share",
              value: loading ? "…" : `${Math.round(avgAmbiguous)}%`,
              delta: "no explicit pro/anti markers detected",
              mono: true,
            },
            {
              label: "Weekly buckets",
              value: loading ? "…" : String(weeklyBuckets),
              delta: "time slices included",
              mono: true,
            },
          ]}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: "12px 24px 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingBottom: 16,
        }}
      >
        {!hydrated && (
          <div className="shimmer" style={{ height: 320, borderRadius: "var(--radius-md)" }} />
        )}

        {hydrated && viewMode === "executive" && (
          <>
            <div className="viz-panel" style={{ flexShrink: 0 }}>
              <div className="viz-panel__header">
                <span className="viz-panel__title">How each post gets classified</span>
                <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  sample corpus posts used as evidence
                </span>
              </div>
              <div style={{ padding: 12, display: "grid", gap: 8 }}>
                {executiveExamples.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    No example posts available.
                  </div>
                )}
                {executiveExamples.map((example) => {
                  const meta = bucketMeta[example.bucket];
                  return (
                    <div key={example.post_id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: "var(--surface-2)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: meta.color, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                          {meta.tone}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-soft)", fontFamily: "var(--font-serif)", lineHeight: 1.65, fontStyle: "italic" }}>
                        "{example.text}"
                      </div>
                      <div style={{ marginTop: 7, fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                        {example.subreddit} · {example.date} · ↑ {example.score} · [{example.post_id}]
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="viz-panel" style={{ flexShrink: 0 }}>
              <div className="viz-panel__header">
                <span className="viz-panel__title">What your weekly buckets show</span>
                <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  simple share view for first-time readers
                </span>
              </div>
              <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
                {[
                  { key: "pro", label: "pro-establishment", color: "#1D9E75", value: avgPro },
                  { key: "amb", label: "ambiguous", color: "#3A4148", value: avgAmbiguous },
                  { key: "anti", label: "anti-establishment", color: "#D85A30", value: avgAnti },
                ].map((row) => (
                  <div key={row.key} style={{ display: "grid", gridTemplateColumns: "170px 1fr 56px", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)" }}>{row.label}</span>
                    <div style={{ border: "1px solid var(--border)", background: "#0D1117", borderRadius: 999, height: 12, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(2, Math.min(100, row.value))}%`, background: row.color, transition: "width 250ms ease" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{Math.round(row.value)}%</span>
                  </div>
                ))}
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
                  Ambiguous means stance is implied by framing and context, not stated explicitly in text.
                </div>
              </div>
            </div>
          </>
        )}

        {hydrated && viewMode === "advanced" && (
          <>
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

              <div
                style={{
                  margin: "8px 12px 0",
                  border: "1px dashed var(--border)",
                  borderRadius: 8,
                  padding: "7px 10px",
                  fontSize: 11,
                  color: "var(--text-soft)",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.5,
                }}
              >
                How to read: thicker band = larger share of posts in that week. Teal = pro-establishment, gray = ambiguous, coral = anti-establishment.
              </div>

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
                    {s.label === "ambiguous" && (
                      <span
                        title="Ambiguous means the model did not find explicit pro/anti stance markers in the text."
                        style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", cursor: "help" }}
                      >
                        (?)
                      </span>
                    )}
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
                  NLI premise: "support for the current US government administration"
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
                    topicId={effectiveActiveTopic ?? undefined}
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

            <details
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                fontSize: 12,
                color: "var(--text-soft)",
                lineHeight: 1.7,
                flexShrink: 0,
              }}
            >
              <summary style={{ cursor: "pointer", fontFamily: "var(--font-mono)", color: "var(--dim)", marginBottom: 8 }}>
                Methodology and caveats
              </summary>
              <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                Stance was classified using cross-encoder/nli-deberta-v3-small in zero-shot mode with the premise "this post expresses support for the current US government administration". Informal Reddit discourse rarely maps cleanly onto explicit pro/contra framings. High ambiguous share is therefore expected and should be read as implicit framing, not model failure. Posts that are confidently classifiable tend to cluster in ideology-explicit communities.
              </div>
            </details>

            {blindSpots.length > 0 && (
              <div className="viz-panel" style={{ flexShrink: 0 }}>
                <div className="viz-panel__header">
                  <span className="viz-panel__title">Model blind spot examples</span>
                  <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    real corpus posts where stance is framing-encoded, not explicit
                  </span>
                </div>
                <div style={{ padding: 12, display: "grid", gap: 8 }}>
                  {blindSpots.slice(0, 6).map((example) => (
                    <div key={example.post_id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-2)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "var(--coral)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {example.bucket.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                          [{example.post_id}] {example.author} · {example.subreddit} · ↑ {example.score} · {example.date}
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-soft)", lineHeight: 1.65, fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                        "{example.text}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}