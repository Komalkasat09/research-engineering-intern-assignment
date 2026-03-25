"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import ClusterLegend from "@/components/ClusterLegend";
import ActiveTopicPanel from "@/components/ActiveTopicPanel";
import type { TopicCluster } from "@/types";

const NarrativeCanvas = dynamic(() => import("@/components/NarrativeCanvas"), {
  ssr: false,
  loading: () => <div className="shimmer" style={{ flex: 1, borderRadius: "var(--radius-md)" }} />,
});

const SpreadGraph = dynamic(() => import("@/components/SpreadGraph"), {
  ssr: false,
  loading: () => <div className="shimmer" style={{ height: "100%", borderRadius: 8 }} />,
});

type PanelTab = "trends" | "origins" | "timeline";

interface TrendNarrative {
  topic_id: number;
  name: string;
  color: string;
  post_count: number;
  velocity_spike: number;
  velocity_change: number;
  origin_subreddit: string;
  peak_week: string;
  rank_reason: {
    score: number;
    velocity_spike: number;
    spread_count: number;
    post_count: number;
  };
}

interface TrendsResponse {
  top_narratives: TrendNarrative[];
}

interface SpreadEntry {
  subreddit: string;
  days_after: number;
}

interface ClusterOrigin {
  topic_id: number;
  name: string;
  origin_subreddit?: string;
  first_date?: string;
  spread?: SpreadEntry[];
  time_to_mainstream_days?: number;
  confidence_label?: "high" | "medium" | "low";
}

interface OriginsResponse {
  clusters: ClusterOrigin[];
}

interface VelocityPoint {
  week: string;
  topic_id: number;
  velocity: number;
}

function parseWeekToTime(week: string): number {
  if (week.includes("/")) {
    const d = new Date(week.split("/")[0]);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const [year, wk] = week.split("-W").map(Number);
  if (Number.isFinite(year) && Number.isFinite(wk)) {
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dow + 1 + (wk - 1) * 7);
    return monday.getTime();
  }
  const fallback = new Date(week);
  return Number.isNaN(fallback.getTime()) ? 0 : fallback.getTime();
}

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const width = 220;
  const height = 44;
  if (!series.length) {
    return <div style={{ width, height, fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>no data</div>;
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(0.0001, max - min);
  const pts = series
    .map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function confidenceColor(label?: "high" | "medium" | "low"): string {
  if (label === "high") return "var(--teal)";
  if (label === "medium") return "var(--amber)";
  return "var(--coral)";
}

export default function ExplorePage() {
  const { activeTopic, setActiveTopic, setInvestigationContext, meta } = useSignalStore();
  const router = useRouter();

  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [trends, setTrends] = useState<TrendNarrative[]>([]);
  const [origins, setOrigins] = useState<ClusterOrigin[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [topicQuery, setTopicQuery] = useState("");
  const [spreadOpen, setSpreadOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<PanelTab>("trends");

  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const [mapDims, setMapDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const saved = window.localStorage.getItem("signal-explore-tab");
    if (saved === "trends" || saved === "origins" || saved === "timeline") {
      setActiveTab(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("signal-explore-tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    Promise.all([
      fetch("/api/clusters").then((r) => r.json()),
      fetch("/api/trends").then((r) => r.json()),
      fetch("/api/origins").then((r) => r.json()),
      fetch("/api/velocity").then((r) => r.json()),
    ])
      .then(([clusterData, trendsData, originsData, velocityData]) => {
        setClusters((clusterData.topics ?? []) as TopicCluster[]);
        setTrends(((trendsData as TrendsResponse).top_narratives ?? []).filter((t) => t.topic_id !== -1));
        setOrigins(((originsData as OriginsResponse).clusters ?? []).filter((o) => o.topic_id !== -1));
        setVelocity((velocityData ?? []) as VelocityPoint[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapCanvasRef.current) return;
    const updateDims = () => {
      if (!mapCanvasRef.current) return;
      const rect = mapCanvasRef.current.getBoundingClientRect();
      setMapDims({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    };

    // Force an immediate initial measurement before waiting for resize events.
    updateDims();

    const obs = new ResizeObserver(() => {
      updateDims();
    });
    obs.observe(mapCanvasRef.current);
    return () => obs.disconnect();
  }, []);

  const topicById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);

  const topicSuggestions = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return [] as TopicCluster[];
    return clusters
      .filter((c) => c.id !== -1)
      .filter((c) => `${c.name} ${(c.top_words ?? []).join(" ")}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [topicQuery, clusters]);

  const filteredTrends = useMemo(
    () => (activeTopic === null ? trends : trends.filter((t) => t.topic_id === activeTopic)),
    [trends, activeTopic],
  );

  const filteredOrigins = useMemo(
    () => (activeTopic === null ? origins : origins.filter((o) => o.topic_id === activeTopic)),
    [origins, activeTopic],
  );

  const velocityByTopic = useMemo(() => {
    const m = new Map<number, VelocityPoint[]>();
    for (const row of velocity) {
      if (!m.has(row.topic_id)) m.set(row.topic_id, []);
      m.get(row.topic_id)?.push(row);
    }
    for (const [id, rows] of m.entries()) {
      m.set(id, [...rows].sort((a, b) => parseWeekToTime(a.week) - parseWeekToTime(b.week)));
    }
    return m;
  }, [velocity]);

  const timelineRows = useMemo(() => {
    const ids = activeTopic === null
      ? [...velocityByTopic.keys()].filter((id) => id !== -1)
      : [activeTopic];

    return ids
      .map((id) => {
        const rows = velocityByTopic.get(id) ?? [];
        return {
          id,
          topic: topicById.get(id),
          values: rows.map((r) => r.velocity),
          latest: rows.length ? rows[rows.length - 1].velocity : 0,
        };
      })
      .filter((x) => x.topic)
      .sort((a, b) => b.latest - a.latest);
  }, [activeTopic, velocityByTopic, topicById]);

  const activeTopicName = useMemo(() => {
    if (activeTopic === null) return null;
    const topic = topicById.get(activeTopic);
    return cleanTopicName(topic?.name ?? `topic #${activeTopic}`);
  }, [activeTopic, topicById]);

  const activeTopicLabel = useMemo(() => {
    if (activeTopic === null) return "all topics";
    return activeTopicName ?? `topic #${activeTopic}`;
  }, [activeTopic, activeTopicName]);

  const totalVelocityPoints = velocity.filter((d) => d.topic_id !== -1).length;

  function selectTopic(topicId: number, source: "trends" | "origins" | "manual") {
    setActiveTopic(topicId);
    setInvestigationContext({
      source,
      topicId,
      narrativeName: cleanTopicName(topicById.get(topicId)?.name ?? `topic #${topicId}`),
      note: `Scoped from /explore ${source} panel`,
      createdAt: Date.now(),
    });
  }

  return (
    <Shell>
      <div style={{ flex: 1, minHeight: 0, height: "100%", overflow: "hidden", padding: "10px 16px 12px", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "0 2px",
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: "var(--strong)", letterSpacing: "-0.02em" }}>
              Explore workspace
            </h2>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {meta?.date_start ?? "—"} to {meta?.date_end ?? "—"} · {(meta?.total_posts ?? 0).toLocaleString()} posts · {clusters.filter((c) => c.id !== -1).length} clusters
            </span>
            <span style={{ fontSize: 11, color: "var(--teal)", fontFamily: "var(--font-mono)" }}>
              filtered: {activeTopicLabel}
            </span>
          </div>

          <StatRow
            stats={[
              {
                label: "posts analysed",
                value: (meta?.total_posts ?? 0).toLocaleString(),
                delta: "+12% vs prev period",
              },
              {
                label: "topic clusters",
                value: String(clusters.filter((c) => c.id !== -1).length),
                delta: `${trends.slice(0, 3).length} active narratives`,
              },
              {
                label: "velocity points",
                value: totalVelocityPoints.toLocaleString(),
                delta: "timeline observations",
              },
              {
                label: "scope",
                value: activeTopic === null ? "all" : `#${activeTopic}`,
                delta: activeTopicLabel,
              },
            ]}
          />
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10 }}>
          <div
            style={{
              width: 360,
              flexShrink: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            <div style={{ position: "sticky", top: 0, zIndex: 5, padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface)" }}>
              <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "trends", label: "TRENDS" },
              { id: "origins", label: "ORIGINS" },
              { id: "timeline", label: "TIMELINE" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`chip ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id as PanelTab)}
                style={{ border: "none", cursor: "pointer" }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTopic !== null && (
            <button
              className="chip active"
              onClick={() => setActiveTopic(null)}
              style={{ border: "none", cursor: "pointer" }}
            >
              Scope: {activeTopicName ?? `topic #${activeTopic}`} ×
            </button>
          )}
            </div>

            <div style={{ padding: 10, display: "grid", gap: 8 }}>
          {activeTab === "trends" && (
            <>
              {filteredTrends.map((t, idx) => (
                <div key={t.topic_id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>{idx + 1}</span>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
                      <button
                        onClick={() => selectTopic(t.topic_id, "trends")}
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontSize: 12, textAlign: "left" }}
                      >
                        {cleanTopicName(t.name)}
                      </button>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--coral)", fontFamily: "var(--font-mono)" }}>
                      {t.velocity_change >= 0 ? "+" : ""}{t.velocity_change.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    score {t.rank_reason.score.toLocaleString()} · velocity {t.rank_reason.velocity_spike.toFixed(3)} · spread {t.rank_reason.spread_count} · posts {t.rank_reason.post_count.toLocaleString()}
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <button
                      className="chip"
                      style={{
                        border: "1px solid var(--border-2)",
                        background: "rgba(29, 158, 117, 0.1)",
                        color: "var(--teal)",
                        borderRadius: 999,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                      onClick={() => selectTopic(t.topic_id, "trends")}
                    >
                      Filter
                    </button>
                    <button
                      className="chip"
                      style={{
                        border: "1px solid rgba(127,119,221,0.45)",
                        background: "rgba(127,119,221,0.14)",
                        color: "#B8B2FF",
                        borderRadius: 999,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                      onClick={() => {
                        selectTopic(t.topic_id, "trends");
                        setSpreadOpen(true);
                      }}
                    >
                      View spread
                    </button>
                  </div>
                </div>
              ))}

              {!loading && filteredTrends.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>No trend cards for this scope.</div>
              )}
            </>
          )}

          {activeTab === "origins" && (
            <>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.1fr 1fr 1fr 1fr", padding: "6px 8px", background: "#0D1117", borderBottom: "1px solid var(--border)" }}>
                  {[
                    "Narrative",
                    "Origin",
                    "First seen",
                    "TTM",
                    "Confidence",
                  ].map((h) => (
                    <span key={h} style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                  ))}
                </div>

                {filteredOrigins.map((o) => (
                  <button
                    key={o.topic_id}
                    onClick={() => selectTopic(o.topic_id, "origins")}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "1.8fr 1.1fr 1fr 1fr 1fr",
                      padding: "8px",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: "transparent",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text)" }}>{cleanTopicName(o.name)}</span>
                    <span style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)" }}>r/{(o.origin_subreddit ?? "unknown").replace(/^r\//, "")}</span>
                    <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>{o.first_date ?? "—"}</span>
                    <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>{o.time_to_mainstream_days ?? 0}d</span>
                    <span style={{ fontSize: 10, color: confidenceColor(o.confidence_label), fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                      {o.confidence_label ?? "low"}
                    </span>
                  </button>
                ))}
              </div>

              {!loading && filteredOrigins.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>No origins rows for this scope.</div>
              )}
            </>
          )}

          {activeTab === "timeline" && (
            <>
              <div style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)", opacity: 0.9 }}>
                {activeTopic === null ? "All topic timelines" : `${activeTopicLabel} timeline`} · click a row to scope the map.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {timelineRows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => selectTopic(row.id, "manual")}
                    style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: activeTopic === row.id ? "rgba(29,158,117,0.14)" : "var(--surface-2)", textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: "var(--text)" }}>{cleanTopicName(row.topic?.name ?? `topic #${row.id}`)}</span>
                      <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                        posts {(row.topic?.count ?? 0).toLocaleString()} · latest {row.latest.toFixed(3)}
                      </span>
                    </div>
                    <Sparkline series={row.values} color={row.topic?.color ?? "#8A9BB0"} />
                  </button>
                ))}
              </div>

              {!loading && timelineRows.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>No timeline rows for this scope.</div>
              )}
            </>
          )}

            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ position: "relative", maxWidth: 520 }}>
              <input
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                placeholder="Search topic or keyword to focus map"
                style={{
                  width: "100%",
                  background: "#0D1014",
                  border: "1px solid #1E2530",
                  borderRadius: 10,
                  padding: "9px 11px",
                  color: "var(--text)",
                  fontSize: 12,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && topicSuggestions.length > 0) {
                    selectTopic(topicSuggestions[0].id, "manual");
                    setTopicQuery("");
                  }
                }}
              />
              {topicSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: "#111418",
                    border: "1px solid #1E2530",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {topicSuggestions.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => {
                        selectTopic(topic.id, "manual");
                        setTopicQuery("");
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid #1E2530",
                        padding: "8px 10px",
                        color: "#C8D3E0",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: topic.color, fontFamily: "var(--font-mono)", marginRight: 8 }}>#{topic.id}</span>
                      {cleanTopicName(topic.name)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "linear-gradient(90deg, rgba(29,158,117,0.08), rgba(127,119,221,0.06))",
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)" }}>
                Click a node label or bottom chip to scope the narrative, then open Timeline, Stance, or Posts Explorer.
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="chip" style={{ cursor: "pointer" }} onClick={() => router.push("/posts")}>Posts explorer</button>
                <button className="chip" style={{ cursor: "pointer" }} onClick={() => router.push("/chat")}>Ask Signal</button>
              </div>
            </div>

            <div
              style={{
                flex: "1 1 auto",
                minHeight: 300,
                position: "relative",
                overflow: "hidden",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "radial-gradient(1200px 500px at 72% 18%, rgba(29,158,117,0.08), transparent 46%), radial-gradient(1000px 420px at 24% 76%, rgba(127,119,221,0.08), transparent 45%), #0A0C0E",
              }}
            >
              <div ref={mapCanvasRef} style={{ width: "100%", height: "100%", position: "relative" }}>
                {mapDims.w > 0 && mapDims.h > 0 && (
                  <>
                    <NarrativeCanvas width={mapDims.w} height={mapDims.h} />
                    <ActiveTopicPanel clusters={clusters} />
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                flexShrink: 0,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
              }}
            >
              <ClusterLegend clusters={clusters} />
            </div>

            <div
              style={{
                display: "flex",
                gap: 16,
                fontSize: 10,
                color: "var(--muted)",
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
        </div>

        {spreadOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <div style={{ width: "min(1100px, 94vw)", height: "min(740px, 90vh)", background: "#0A0C0E", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                  Spread graph {activeTopic !== null ? `· topic #${activeTopic}` : "· all topics"}
                </span>
                <button className="chip" style={{ cursor: "pointer" }} onClick={() => setSpreadOpen(false)}>Close</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, padding: 10 }}>
                <SpreadGraph width={1040} height={640} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
