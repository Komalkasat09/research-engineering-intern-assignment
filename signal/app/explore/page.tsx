"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { useBreakpoint } from "@/lib/useBreakpoint";
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
const UmapScatter = dynamic(() => import("@/components/UmapScatter"), { ssr: false, loading: () => <div className="shimmer" style={{height:280,borderRadius:8}} /> });

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

interface ClusterAutoScopeItem {
  id: number;
  label: string;
  velocity: number;
  score: number;
  post_count: number;
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
  const { activeTopic, setActiveTopic, setInvestigationContext, setVisibleClusterIds, meta } = useSignalStore();
  const router = useRouter();
  const { isNarrow } = useBreakpoint();
  const [isClient, setIsClient] = useState(false);

  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [trends, setTrends] = useState<TrendNarrative[]>([]);
  const [origins, setOrigins] = useState<ClusterOrigin[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [clusterK, setClusterK] = useState(0);
  const [maxClusters, setMaxClusters] = useState(0);
  const [clusterAutoScopeItems, setClusterAutoScopeItems] = useState<ClusterAutoScopeItem[]>([]);
  const [autoScopeBanner, setAutoScopeBanner] = useState<string | null>(null);
  const [timelineSummary, setTimelineSummary] = useState<string>("");
  const [timelineSummaryLoading, setTimelineSummaryLoading] = useState(false);
  const [timelineDetailedSummary, setTimelineDetailedSummary] = useState<string>("");
  const [timelineDetailedLoading, setTimelineDetailedLoading] = useState(false);
  const [spreadOpen, setSpreadOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<PanelTab>("trends");

  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);
  const [mapDims, setMapDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setIsClient(true);
  }, []);

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
        const clusterList = (Array.isArray(clusterData)
          ? clusterData
          : (clusterData.topics ?? [])) as Array<Record<string, unknown>>;

        setClusters(clusterList as unknown as TopicCluster[]);
        setMaxClusters(clusterList.filter((c) => Number(c.id) !== -1).length);

        setClusterAutoScopeItems(
          clusterList
            .map((c) => {
              const id = Number(c.id ?? -1);
              const label = String(c.label ?? c.name ?? `topic #${id}`);
              const velocity = Number(c.velocity ?? 0);
              const score = Number(c.score ?? 0);
              const post_count = Number(c.post_count ?? c.count ?? 0);
              return { id, label, velocity, score, post_count };
            })
            .filter((c) => Number.isFinite(c.id) && c.id !== -1)
        );

        setTrends(((trendsData as TrendsResponse).top_narratives ?? []).filter((t) => t.topic_id !== -1));
        setOrigins(((originsData as OriginsResponse).clusters ?? []).filter((o) => o.topic_id !== -1));
        setVelocity((velocityData ?? []) as VelocityPoint[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      fetch(`/api/clusters?k=${clusterK}`)
        .then((r) => r.json())
        .then((clusterData) => {
          const clusterList = (Array.isArray(clusterData)
            ? clusterData
            : (clusterData.topics ?? [])) as Array<Record<string, unknown>>;
          const newClusters = clusterList as unknown as TopicCluster[];
          setClusters(newClusters);

          const visibleIds = newClusters
            .filter((c) => c.id !== -1)
            .map((c) => c.id);
          setVisibleClusterIds(clusterK === 0 ? null : visibleIds);
        })
        .catch(console.error);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [clusterK, setVisibleClusterIds]);

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;

    const sessionKey = "signal-explore-auto-scope-once";
    if (window.sessionStorage.getItem(sessionKey) === "1") return;

    // Respect persisted user scope from Zustand hydration.
    if (activeTopic !== null && activeTopic !== undefined) {
      window.sessionStorage.setItem(sessionKey, "1");
      return;
    }

    if (!clusterAutoScopeItems.length) return;

    const highestVelocity = clusterAutoScopeItems.reduce((best, cur) =>
      cur.velocity > best.velocity ? cur : best
    );

    setActiveTopic(highestVelocity.id);
    setAutoScopeBanner(
      `Auto-scoped to highest velocity topic · ${highestVelocity.label} · click any bubble to change`
    );
    window.sessionStorage.setItem(sessionKey, "1");
  }, [loading, activeTopic, clusterAutoScopeItems, setActiveTopic]);

  useEffect(() => {
    if (!autoScopeBanner) return;
    const timer = window.setTimeout(() => setAutoScopeBanner(null), 4000);
    return () => window.clearTimeout(timer);
  }, [autoScopeBanner]);

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

  const filteredTrends = useMemo(() => {
    const allowedIds = new Set(clusters.map((c) => c.id));
    const scopeFiltered = activeTopic === null
      ? trends
      : trends.filter((t) => t.topic_id === activeTopic);
    return scopeFiltered.filter((t) => allowedIds.has(t.topic_id));
  }, [trends, activeTopic, clusters]);

  const filteredOrigins = useMemo(() => {
    const allowedIds = new Set(clusters.map((c) => c.id));
    const scopeFiltered = activeTopic === null
      ? origins
      : origins.filter((o) => o.topic_id === activeTopic);
    return scopeFiltered.filter((o) => allowedIds.has(o.topic_id));
  }, [origins, activeTopic, clusters]);

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
  const isNarrowSafe = isClient ? isNarrow : false;
  const shouldStretchTrendCards = !isNarrowSafe && filteredTrends.length > 0 && filteredTrends.length <= 8;

  useEffect(() => {
    if (activeTab !== "timeline") return;
    if (!timelineRows.length) {
      setTimelineSummary("");
      setTimelineDetailedSummary("");
      return;
    }

    const topRows = timelineRows.slice(0, 3);
    const context = [
      `Current scope: ${activeTopicLabel}.`,
      `Visible timeline rows: ${timelineRows.length}.`,
      `Top narrative snapshots: ${topRows
        .map((row) => `${cleanTopicName(row.topic?.name ?? `topic #${row.id}`)} latest ${row.latest.toFixed(3)} across ${row.values.length} points`)
        .join("; ")}.`,
    ].join(" ");

    const controller = new AbortController();
    setTimelineSummaryLoading(true);
    setTimelineDetailedSummary("");

    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context,
        prompt: "Write 2 concise sentences explaining what these timeline trends imply for investigation prioritization.",
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`summary: ${r.status}`);
        return r.json() as Promise<{ summary?: string }>;
      })
      .then((d) => setTimelineSummary((d.summary ?? "").trim()))
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return;
        console.error("[/explore] timeline summary", err);
      })
      .finally(() => setTimelineSummaryLoading(false));

    return () => controller.abort();
  }, [activeTab, timelineRows, activeTopicLabel]);

  function generateDetailedTimelineSummary() {
    if (!timelineRows.length || timelineDetailedLoading) return;

    const topRows = timelineRows.slice(0, 5);
    const context = [
      `Current scope: ${activeTopicLabel}.`,
      `Timeline rows: ${timelineRows.length}.`,
      `Top rows by latest velocity: ${topRows
        .map((row) => `${cleanTopicName(row.topic?.name ?? `topic #${row.id}`)} latest ${row.latest.toFixed(3)} points ${row.values.length}`)
        .join("; ")}.`,
    ].join(" ");

    setTimelineDetailedLoading(true);
    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context,
        prompt: "Write a detailed 5-6 sentence timeline analysis. Include where momentum is accelerating or cooling, what to investigate next, and one caution about over-interpreting sparse points.",
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`summary: ${r.status}`);
        return r.json() as Promise<{ summary?: string }>;
      })
      .then((d) => setTimelineDetailedSummary((d.summary ?? "").trim()))
      .catch((err) => {
        console.error("[/explore] detailed timeline summary", err);
      })
      .finally(() => setTimelineDetailedLoading(false));
  }

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
      <div style={{ flex: 1, minHeight: 0, overflow: "visible", padding: "10px 16px 40px", display: "flex", flexDirection: "column" }}>
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

          {autoScopeBanner && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid rgba(29,158,117,0.35)",
                background: "rgba(29,158,117,0.08)",
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 11,
                color: "var(--text-soft)",
                fontFamily: "var(--font-mono)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span>{autoScopeBanner}</span>
              <button
                type="button"
                onClick={() => setAutoScopeBanner(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
                aria-label="Dismiss auto-scope banner"
              >
                x
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            minHeight: isNarrowSafe ? 600 : undefined,
            gap: 10,
            flexDirection: isNarrowSafe ? "column" : "row",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              width: isNarrowSafe ? "100%" : "clamp(260px, 28vw, 380px)",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              minHeight: isNarrowSafe ? "auto" : undefined,
              overflowY: "visible",
              overflowX: "hidden",
            }}
          >
            <div style={{ position: "relative", padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--surface)" }}>
              <div style={{ width: "100%", display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

                <div style={{ padding: "4px 0 0", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                    clusters: {clusterK === 0 ? "all" : clusterK}
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={maxClusters >= 2 ? maxClusters : 20}
                    value={clusterK === 0 ? (maxClusters >= 2 ? maxClusters : 20) : clusterK}
                    onChange={(e) => setClusterK(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--teal)", cursor: "pointer" }}
                  />
                  {clusterK !== 0 && (
                    <button
                      onClick={() => setClusterK(0)}
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      reset
                    </button>
                  )}
                </div>

                {activeTopic !== null && (
                  <button
                    className="chip active"
                    onClick={() => setActiveTopic(null)}
                    style={{ border: "none", cursor: "pointer", justifySelf: "start" }}
                  >
                    Scope: {activeTopicName ?? `topic #${activeTopic}`} ×
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
          {activeTab === "trends" && (
            <>
              <div
                style={shouldStretchTrendCards
                  ? {
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      flex: 1,
                      minHeight: 0,
                    }
                  : { display: "flex", flexDirection: "column", gap: 8 }}
              >
              {filteredTrends.map((t, idx) => (
                <div key={t.topic_id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-2)", flex: shouldStretchTrendCards ? "1 1 0" : undefined, display: "grid", alignContent: "start", gap: 4 }}>
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
              </div>

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
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", padding: "8px 10px", display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.6, fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                  {timelineSummaryLoading
                    ? "Generating timeline summary..."
                    : (timelineSummary || "Timeline summary will appear after data loads.")}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    className="chip"
                    onClick={generateDetailedTimelineSummary}
                    style={{ cursor: timelineDetailedLoading ? "not-allowed" : "pointer", opacity: timelineDetailedLoading ? 0.6 : 1 }}
                    disabled={timelineDetailedLoading || timelineRows.length === 0}
                  >
                    {timelineDetailedLoading ? "Generating..." : "Detailed summary"}
                  </button>
                  {!!timelineDetailedSummary && (
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                      detailed analysis ready
                    </span>
                  )}
                </div>
                {!!timelineDetailedSummary && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, fontSize: 12, color: "var(--text-soft)", lineHeight: 1.7, fontFamily: "var(--font-serif)" }}>
                    {timelineDetailedSummary}
                  </div>
                )}
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
                minHeight: isNarrowSafe ? 420 : 300,
                height: isNarrowSafe ? 420 : undefined,
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

            <UmapScatter clusters={clusters} />

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
