"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";

interface TrendNarrative {
  topic_id: number;
  name: string;
  color: string;
  post_count: number;
  velocity_spike: number;
  velocity_change: number;
  top_post: {
    text: string;
    author: string;
    subreddit: string;
    score: number;
    date: string;
  };
  origin_subreddit: string;
  peak_week: string;
  confidence_score: number;
  confidence_label: "high" | "medium" | "low";
  rank_reason: {
    score: number;
    velocity_spike: number;
    spread_count: number;
    post_count: number;
  };
}

interface AmplifiedAccount {
  author: string;
  subreddit: string;
  score: number;
  topic_name: string;
}

interface TrendsResponse {
  top_narratives: TrendNarrative[];
  most_amplified_accounts: AmplifiedAccount[];
  emerging_terms: string[];
  summary_stats: {
    fastest_rising: string;
    most_posts: string;
    mutation_count: number;
    peak_velocity: number;
  };
}

interface NarrativeDiffRow {
  topic_id: number;
  added?: Array<{ term: string; count: number }>;
  dropped?: Array<{ term: string; count: number }>;
}

interface AlertRow {
  topic_id?: number;
  severity?: "high" | "medium" | "low";
  score?: number;
  reason?: string;
}

interface CounterfactualRow {
  topic_id: number;
  top_account: string;
  impact_pct: number;
}

function velocityBadge(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `↑ ${sign}${change.toFixed(0)}% velocity`;
}

function confidenceColor(label: TrendNarrative["confidence_label"]): string {
  if (label === "high") return "var(--teal)";
  if (label === "medium") return "var(--amber)";
  return "var(--coral)";
}

export default function TrendsPage() {
  const router = useRouter();
  const { setActiveTopic, setInvestigationContext } = useSignalStore();
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [diffs, setDiffs] = useState<NarrativeDiffRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [counterfactual, setCounterfactual] = useState<CounterfactualRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then((d: TrendsResponse) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/narrative-diff")
      .then((r) => r.json())
      .then((d) => setDiffs((d.diffs ?? []) as NarrativeDiffRow[]))
      .catch(() => setDiffs([]));

    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlerts((d.alerts ?? []) as AlertRow[]))
      .catch(() => setAlerts([]));

    fetch("/api/counterfactual")
      .then((r) => r.json())
      .then((d) => setCounterfactual((d.topics ?? []) as CounterfactualRow[]))
      .catch(() => setCounterfactual([]));
  }, []);

  const maxSpike = useMemo(() => {
    if (!data?.top_narratives?.length) return 1;
    return Math.max(...data.top_narratives.map((n) => n.velocity_spike), 0.0001);
  }, [data]);

  function primeInvestigation(narrative: TrendNarrative, note: string) {
    setActiveTopic(narrative.topic_id);
    setInvestigationContext({
      source: "trends",
      topicId: narrative.topic_id,
      narrativeName: narrative.name,
      originSubreddit: narrative.origin_subreddit,
      topPostAuthor: narrative.top_post.author,
      topPostScore: narrative.top_post.score,
      note,
      createdAt: Date.now(),
    });
  }

  function openRoute(route: string, narrative: TrendNarrative, note: string) {
    primeInvestigation(narrative, note);
    router.push(route);
  }

  function openChatInvestigation(narrative: TrendNarrative) {
    const prompt = `Investigate narrative \"${narrative.name}\" (topic #${narrative.topic_id}) from ${narrative.origin_subreddit}. Use evidence from top posts and list likely amplifiers, timeline inflection points, and innocent explanations.`;
    openRoute(`/chat?q=${encodeURIComponent(prompt)}`, narrative, "Investigate narrative from trends card");
  }

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Trends</span>
        <span className="page-header__meta">
          rising narratives · velocity spikes · most amplified posts
        </span>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Fastest rising",
              value: loading ? "…" : (data?.summary_stats.fastest_rising ?? "—"),
              delta: "highest recent velocity spike",
              mono: true,
            },
            {
              label: "Most posts",
              value: loading ? "…" : (data?.summary_stats.most_posts ?? "—"),
              delta: "largest cluster volume",
              mono: true,
            },
            {
              label: "Narrative mutations",
              value: loading ? "…" : String(data?.summary_stats.mutation_count ?? 0),
              delta: "clusters with velocity > 0.3",
              mono: true,
            },
            {
              label: "Peak velocity",
              value: loading ? "…" : (data?.summary_stats.peak_velocity ?? 0).toFixed(3),
              delta: "highest single observation",
              mono: true,
            },
          ]}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 24px 24px" }}>
        <div className="viz-panel" style={{ marginBottom: 12 }}>
          <div className="viz-panel__header">
            <span className="viz-panel__title">Top trending narratives</span>
            <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
              ranked by recent velocity spike
            </span>
          </div>

          <div style={{ padding: 12, display: "grid", gap: 10 }}>
            {loading && <div className="shimmer" style={{ height: 220, borderRadius: "var(--radius-md)" }} />}

            {!loading && (data?.top_narratives?.length ?? 0) === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", padding: 6 }}>
                No trend narratives available.
              </div>
            )}

            {(data?.top_narratives ?? [])
              .filter((n) => n.topic_id !== -1)
              .map((narrative, idx) => {
              const width = Math.max(4, Math.min(100, (narrative.velocity_spike / maxSpike) * 100));
              return (
                <div
                  key={narrative.topic_id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface-2)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--dim)",
                        fontFamily: "var(--font-mono)",
                        width: 20,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: narrative.color }} />
                    <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
                      {narrative.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: confidenceColor(narrative.confidence_label),
                        fontFamily: "var(--font-mono)",
                        border: `1px solid ${confidenceColor(narrative.confidence_label)}44`,
                        background: `${confidenceColor(narrative.confidence_label)}14`,
                        borderRadius: 20,
                        padding: "2px 8px",
                        marginLeft: 8,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {narrative.confidence_label} confidence
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        color: "var(--coral)",
                        fontFamily: "var(--font-mono)",
                        border: "1px solid rgba(216, 90, 48, 0.35)",
                        background: "rgba(216, 90, 48, 0.08)",
                        borderRadius: 20,
                        padding: "2px 8px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {velocityBadge(narrative.velocity_change)}
                    </span>
                  </div>

                  <div style={{ padding: "8px 12px 10px" }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--dim)",
                        fontFamily: "var(--font-mono)",
                        marginBottom: 8,
                      }}
                    >
                      {narrative.post_count.toLocaleString()} posts · {narrative.origin_subreddit} · peak {narrative.peak_week}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      {[
                        { label: "score", value: `↑ ${narrative.rank_reason.score.toLocaleString()}` },
                        { label: "velocity", value: narrative.rank_reason.velocity_spike.toFixed(3) },
                        { label: "spread", value: `${narrative.rank_reason.spread_count} subs` },
                        { label: "post_count", value: narrative.rank_reason.post_count.toLocaleString() },
                      ].map((metric) => (
                        <div key={metric.label} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "5px 7px", background: "#0D1117" }}>
                          <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {metric.label}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                            {metric.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      <button
                        className="chip active"
                        style={{ border: "none", background: "rgba(29,158,117,0.14)", cursor: "pointer" }}
                        onClick={() => openChatInvestigation(narrative)}
                      >
                        Investigate
                      </button>
                      <button
                        className="chip"
                        style={{ border: "none", background: "transparent", cursor: "pointer" }}
                        onClick={() => openRoute("/graph", narrative, "Open graph from trends drillthrough")}
                      >
                        Graph
                      </button>
                      <button
                        className="chip"
                        style={{ border: "none", background: "transparent", cursor: "pointer" }}
                        onClick={() => openRoute("/stance", narrative, "Open stance from trends drillthrough")}
                      >
                        Stance
                      </button>
                      <button
                        className="chip"
                        style={{ border: "none", background: "transparent", cursor: "pointer" }}
                        onClick={() => openRoute("/map", narrative, "Open map from trends drillthrough")}
                      >
                        Map
                      </button>
                      <button
                        className="chip"
                        style={{ border: "none", background: "transparent", cursor: "pointer" }}
                        onClick={() => openRoute(`/chat?q=${encodeURIComponent(`Show 5 raw posts for narrative ${narrative.name} with timestamps and scores.`)}`, narrative, "Request raw posts from trends drillthrough")}
                      >
                        Raw posts
                      </button>
                    </div>

                    <div
                      style={{
                        height: 5,
                        borderRadius: 999,
                        background: "#0D1117",
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${width}%`,
                          background: narrative.color,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--text-soft)",
                        fontFamily: "var(--font-serif)",
                        fontStyle: "italic",
                        lineHeight: 1.7,
                      }}
                    >
                      "{narrative.top_post.text || "No exemplar post available."}"
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        fontFamily: "var(--font-mono)",
                        marginTop: 8,
                      }}
                    >
                      {narrative.top_post.author} · {narrative.top_post.subreddit} · ↑ {narrative.top_post.score}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          <div className="viz-panel">
            <div className="viz-panel__header">
              <span className="viz-panel__title">Most amplified accounts</span>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {(data?.most_amplified_accounts ?? []).map((row) => (
                <div
                  key={`${row.author}-${row.topic_name}`}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 10px",
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                      {row.author}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>
                      ↑ {row.score.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                    {row.subreddit} · {row.topic_name}
                  </div>
                </div>
              ))}

              {!loading && (data?.most_amplified_accounts?.length ?? 0) === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  No amplified accounts available.
                </div>
              )}
            </div>
          </div>

          <div className="viz-panel">
            <div className="viz-panel__header">
              <span className="viz-panel__title">Emerging narratives</span>
            </div>
            <div style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(data?.emerging_terms ?? []).map((term) => (
                <span
                  key={term}
                  style={{
                    fontSize: 11,
                    color: "var(--text-soft)",
                    fontFamily: "var(--font-mono)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 999,
                    padding: "4px 10px",
                    background: "var(--surface-2)",
                  }}
                >
                  {term}
                </span>
              ))}

              {!loading && (data?.emerging_terms?.length ?? 0) === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  No emerging terms detected.
                </div>
              )}
            </div>
          </div>

          <div className="viz-panel">
            <div className="viz-panel__header">
              <span className="viz-panel__title">Narrative language drift</span>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {diffs.slice(0, 4).map((d) => (
                <div key={d.topic_id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 10px", background: "var(--surface-2)" }}>
                  <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                    topic #{d.topic_id}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                    added: {(d.added ?? []).slice(0, 3).map((x) => x.term).join(", ") || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                    dropped: {(d.dropped ?? []).slice(0, 3).map((x) => x.term).join(", ") || "—"}
                  </div>
                </div>
              ))}
              {!loading && diffs.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  No language drift snapshots available.
                </div>
              )}
            </div>
          </div>

          <div className="viz-panel">
            <div className="viz-panel__header">
              <span className="viz-panel__title">Active anomaly alerts</span>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {alerts.slice(0, 5).map((a, i) => (
                <div key={`${a.topic_id}-${i}`} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 10px", background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--amber)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                      {a.severity ?? "low"}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                      topic #{a.topic_id ?? "?"} · {Number(a.score ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-soft)", lineHeight: 1.5 }}>{a.reason ?? "anomaly detected"}</div>
                </div>
              ))}
              {!loading && alerts.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  No active alerts.
                </div>
              )}
            </div>
          </div>

          <div className="viz-panel">
            <div className="viz-panel__header">
              <span className="viz-panel__title">Counterfactual impact</span>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {counterfactual
                .slice()
                .sort((a, b) => b.impact_pct - a.impact_pct)
                .slice(0, 5)
                .map((row) => (
                  <div key={`${row.topic_id}-${row.top_account}`} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 10px", background: "var(--surface-2)" }}>
                    <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-mono)", marginBottom: 3 }}>
                      topic #{row.topic_id} · {row.top_account}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--coral)", fontFamily: "var(--font-mono)" }}>
                      peak drops by {row.impact_pct.toFixed(1)}% if removed
                    </div>
                  </div>
                ))}
              {!loading && counterfactual.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  No counterfactual summaries available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
