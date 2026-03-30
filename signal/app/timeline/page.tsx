// FILE: app/timeline/page.tsx
"use client";

/**
 * /timeline — Narrative Velocity chart with Wikipedia event stitching.
 *
 * The "narrative velocity" metric is Signal's key original contribution:
 *   velocity(week) = cosine_distance(centroid(week-1), centroid(week))
 *
 * Where centroid(week) = mean SBERT embedding of all posts in that week
 * for a given topic cluster. High velocity = the language used to discuss
 * this topic changed significantly compared to the previous week.
 *
 * Why this matters for research: a narrative that's spreading AND mutating
 * fast is harder to fact-check than one that's just spreading, because the
 * semantic target keeps moving. This is a disinfo-relevant insight.
 *
 * Wikipedia event stitching: we fetch real-world events from the Wikipedia
 * REST API at runtime (pinned political events + Wikipedia summaries).
 * These appear as vertical annotation lines on the chart. When a velocity
 * spike co-occurs with a real event (election, court ruling), that's a
 * meaningful correlation — institutional events drive narrative shifts.
 *
 * The D3 brush lets users select a date range, which syncs back to the
 * Zustand store and scopes other views to that time window.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import TopicLegendBar from "@/components/TopicLegendBar";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { fetchWikiEvents, type WikiEvent } from "@/lib/wikiEvents";
import { useSignalStore } from "@/lib/store";
import type { VelocityPoint } from "@/components/VelocityChart";
import type { TopicCluster } from "@/types";

// ── Dynamic import — D3 uses document at module load ─────────────────────────

const VelocityChart = dynamic(
  () => import("@/components/VelocityChart"),
  {
    ssr: false,
    loading: () => (
      <div
        className="shimmer"
        style={{ flex: 1, minHeight: 0, borderRadius: "var(--radius-md)" }}
      />
    ),
  }
);

// ── Helper functions ──────────────────────────────────────────────────────────

function peakVelocityWeek(data: VelocityPoint[]): string {
  if (!data.length) return "—";
  return data.reduce((best, d) => (d.velocity > best.velocity ? d : best), data[0]).week;
}

function avgVelocity(data: VelocityPoint[]): string {
  if (!data.length) return "—";
  const avg = data.reduce((s, d) => s + d.velocity, 0) / data.length;
  return avg.toFixed(3);
}

function highVelocityCount(data: VelocityPoint[], threshold = 0.25): number {
  return data.filter((d) => d.velocity > threshold).length;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { activeTopic } = useSignalStore();

  // Panel measurement for the D3 chart
  const panelRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  // Data state
  const [velocity, setVelocity]   = useState<VelocityPoint[]>([]);
  const [clusters, setClusters]   = useState<TopicCluster[]>([]);
  const [events,   setEvents]     = useState<WikiEvent[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState<string | null>(null);
  const [insightText, setInsightText] = useState(
    "Velocity peaks correlate with major political events — elections, policy announcements, and viral controversies drive measurable shifts in how communities discuss political topics online."
  );
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Load all data in parallel ────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    const topicParam = activeTopic !== null ? `?topic_id=${activeTopic}` : "";

    Promise.all([
      fetch(`/api/velocity${topicParam}`)
        .then((r) => { if (!r.ok) throw new Error(`velocity: ${r.status}`); return r.json(); }),
      fetch("/api/clusters")
        .then((r) => { if (!r.ok) throw new Error(`clusters: ${r.status}`); return r.json(); }),
      fetchWikiEvents(),
    ])
      .then(([vel, clusterData, wiki]) => {
        setVelocity(vel as VelocityPoint[]);
        setClusters((clusterData as { topics: TopicCluster[] }).topics ?? []);
        setEvents(wiki);
      })
      .catch((err: Error) => {
        console.error("[/timeline]", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [activeTopic]);

  // ── Measure panel ────────────────────────────────────────────────
  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Derived data ─────────────────────────────────────────────────
  const topicColors = useMemo(
    () => Object.fromEntries(clusters.map((c) => [c.id, c.color])),
    [clusters]
  );
  const topicNames = useMemo(
    () => Object.fromEntries(clusters.map((c) => [c.id, cleanTopicName(c.name)])),
    [clusters]
  );

  // Apply topic filter if active
  const filteredVelocity = useMemo(
    () =>
      activeTopic !== null
        ? velocity.filter((d) => d.topic_id === activeTopic)
        : velocity,
    [velocity, activeTopic]
  );

  // Stats
  const peak     = peakVelocityWeek(filteredVelocity);
  const avg      = avgVelocity(filteredVelocity);
  const highVel  = highVelocityCount(filteredVelocity);
  const activeTopicName = activeTopic !== null
    ? (topicNames[activeTopic] ?? `topic ${activeTopic}`)
    : null;

  useEffect(() => {
    if (!filteredVelocity.length) return;

    const peakWeek = peakVelocityWeek(filteredVelocity);
    const averageVelocity = avgVelocity(filteredVelocity);
    const highVelWeeks = highVelocityCount(filteredVelocity);
    const topicName = activeTopic !== null
      ? (topicNames[activeTopic] ?? `topic #${activeTopic}`)
      : "all topics";

    const controller = new AbortController();
    setInsightLoading(true);

    fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: `Narrative velocity data for ${topicName}. Peak week: ${peakWeek}. Average drift: ${averageVelocity}. High velocity weeks (>0.25): ${highVelWeeks} of ${filteredVelocity.length}. Data spans Jul 2024 to Feb 2025.`,
        prompt: "Write 2 sentences for a non-technical audience explaining what this narrative velocity data shows. Be specific about what the numbers mean in plain language.",
      }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`summary: ${r.status}`);
        return r.json() as Promise<{ summary?: string }>;
      })
      .then((d) => {
        const summary = (d.summary ?? "").trim();
        if (summary) setInsightText(summary);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        console.error("[/timeline] summary", err);
      })
      .finally(() => setInsightLoading(false));

    return () => controller.abort();
  }, [filteredVelocity, activeTopic, topicNames]);

  return (
    <Shell>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <span className="page-header__title">Timeline</span>
        <span className="page-header__meta">
          narrative velocity · Wikipedia event stitching · drag to select range
        </span>
        {activeTopicName && (
          <span
            style={{
              fontSize:   11,
              color:      "var(--teal)",
              fontFamily: "var(--font-mono)",
              marginLeft: 4,
            }}
          >
            · topic #{activeTopic} — {activeTopicName}
          </span>
        )}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Peak velocity week",
              value: loading ? "…" : peak,
              delta: "highest cosine drift",
              mono:  true,
            },
            {
              label: "Events pinned",
              value: String(events.length),
              delta: "elections · rulings · protests",
              mono:  true,
            },
            {
              label: "Avg weekly drift",
              value: loading ? "…" : avg,
              delta: "cosine distance",
              mono:  true,
            },
            {
              label:      "High-velocity weeks",
              value:      loading ? "…" : String(highVel),
              delta:      "velocity > 0.25",
              deltaColor: highVel > 20 ? "var(--coral)" : "var(--amber)",
              mono:       true,
            },
          ]}
        />
      </div>

      {/* ── Main chart panel ────────────────────────────────────────── */}
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
          {/* Panel header with event legend */}
          <div className="viz-panel__header">
            <span className="viz-panel__title">
              Narrative velocity over time
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
                : `${filteredVelocity.length.toLocaleString()} data points · scroll to zoom · drag to filter`}
            </span>
          </div>

          {/* Event pins legend row */}
          {!loading && events.length > 0 && (
            <div
              style={{
                padding:      "6px 14px",
                borderBottom: "1px solid var(--border)",
                display:      "flex",
                gap:          10,
                flexWrap:     "wrap",
                alignItems:   "center",
                flexShrink:   0,
              }}
            >
              <span
                style={{
                  fontSize:      9,
                  color:         "#3A4148",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  flexShrink:    0,
                }}
              >
                pinned events
              </span>
              {events.map((evt) => (
                <a
                  key={evt.date}
                  href={evt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={evt.description}
                  style={{
                    display:        "inline-flex",
                    alignItems:     "center",
                    gap:            5,
                    fontSize:       10,
                    color:          evt.color,
                    textDecoration: "none",
                    fontFamily:     "var(--font-mono)",
                    opacity:        0.75,
                    transition:     "opacity 150ms ease",
                    flexShrink:     0,
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseOut ={(e) => (e.currentTarget.style.opacity = "0.75")}
                >
                  <span
                    style={{
                      display:     "inline-block",
                      width:       6,
                      height:      10,
                      borderLeft:  `2px dashed ${evt.color}`,
                      opacity:     0.7,
                      flexShrink:  0,
                    }}
                  />
                  <span>{evt.date.slice(0, 7)} {evt.title.split(" ").slice(0, 3).join(" ")}</span>
                </a>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div
              style={{
                padding:    "12px 14px",
                fontSize:   12,
                color:      "var(--coral)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Error loading velocity data: {error}
            </div>
          )}

          {/* D3 chart */}
          <div
            className="viz-panel__body"
            style={{ padding: "8px 8px 0", overflow: "hidden" }}
          >
            {!loading && !error && dims.w > 0 && dims.h > 80 && (
              <VelocityChart
                data={filteredVelocity}
                events={events}
                width={dims.w - 16}
                height={dims.h - 80}
                topicColors={topicColors}
                topicNames={topicNames}
              />
            )}
            {loading && (
              <div
                className="shimmer"
                style={{
                  height:       300,
                  borderRadius: "var(--radius-sm)",
                  margin:       "8px 0",
                }}
              />
            )}
          </div>
        </div>

        {/* Topic legend bar */}
        {!loading && velocity.length > 0 && (
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding:      "8px 12px",
              flexShrink:   0,
            }}
          >
            <TopicLegendBar
              topicColors={topicColors}
              topicNames={topicNames}
              data={velocity}
            />
          </div>
        )}

        {/* AI insight digest */}
        {!loading && (
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding:      "12px 14px",
              display:      "flex",
              gap:          12,
              alignItems:   "flex-start",
              flexShrink:   0,
            }}
          >
            {/* Signal avatar */}
            <div
              style={{
                width:          24,
                height:         24,
                borderRadius:   "50%",
                background:     "rgba(29,158,117,0.15)",
                border:         "1px solid rgba(29,158,117,0.3)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                flexShrink:     0,
                fontSize:       11,
                fontWeight:     500,
                color:          "var(--teal)",
              }}
            >
              S
            </div>

            <div>
              {/* Insight text — serif font = editorial/findings register */}
              <p
                style={{
                  fontSize:    13,
                  fontFamily:  "var(--font-serif)",
                  fontStyle:   "italic",
                  color:       "#A0AEC0",
                  lineHeight:  1.7,
                  marginBottom: 6,
                }}
              >
                {insightLoading ? "Signal is generating a plain-language summary from the current velocity metrics..." : insightText}
              </p>
              <div
                style={{
                  fontSize:   10,
                  color:      "#3A4148",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Signal analysis · drag chart to filter date range · click topic to isolate line
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}