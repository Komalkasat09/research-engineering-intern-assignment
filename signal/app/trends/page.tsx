"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";

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

function velocityBadge(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `↑ ${sign}${change.toFixed(0)}% velocity`;
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then((d: TrendsResponse) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const maxSpike = useMemo(() => {
    if (!data?.top_narratives?.length) return 1;
    return Math.max(...data.top_narratives.map((n) => n.velocity_spike), 0.0001);
  }, [data]);

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
        </div>
      </div>
    </Shell>
  );
}
