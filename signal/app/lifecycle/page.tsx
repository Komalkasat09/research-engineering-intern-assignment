"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";

interface LifecyclePhase {
  phase: string;
  post_count: number;
  date_start: string;
  date_end: string;
  avg_sentiment: number;
  avg_toxicity: number;
}

interface LifecyclePost {
  text: string;
  author: string;
  subreddit: string;
  score: number;
  date: string;
  toxicity: number;
  sentiment: number;
}

interface LifecycleCluster {
  topic_id: number;
  name: string;
  color: string;
  avg_sentiment: number;
  avg_toxicity: number;
  phases: LifecyclePhase[];
  monthly?: Array<{
    month: string;
    post_count: number;
    avg_sentiment: number;
    avg_toxicity: number;
    max_toxicity?: number;
  }>;
  most_toxic_post: LifecyclePost;
  most_viral_post: LifecyclePost;
}

interface LifecycleResponse {
  lifecycle: LifecycleCluster[];
  corpus_stats: {
    avg_sentiment: number;
    avg_toxicity: number;
    high_toxicity_count: number;
    rage_amplification: number;
    most_toxic_cluster: number;
  };
}

const FALLBACK: LifecycleResponse = {
  lifecycle: [],
  corpus_stats: {
    avg_sentiment: 0,
    avg_toxicity: 0,
    high_toxicity_count: 0,
    rage_amplification: 0,
    most_toxic_cluster: -1,
  },
};

function toxicityScaleColor(v: number): string {
  const x = Math.max(0, Math.min(1, v));
  if (x <= 0.3) return "#1D9E75";
  if (x <= 0.6) return "#BA7517";
  return "#D85A30";
}

function toxicityBadge(v: number): { label: string; color: string; bg: string; border: string } {
  if (v < 0.3) {
    return {
      label: "LOW",
      color: "#1D9E75",
      bg: "rgba(29,158,117,0.12)",
      border: "rgba(29,158,117,0.45)",
    };
  }
  if (v < 0.6) {
    return {
      label: "HEATED",
      color: "#BA7517",
      bg: "rgba(186,117,23,0.14)",
      border: "rgba(186,117,23,0.45)",
    };
  }
  return {
    label: "HIGH TOXICITY",
    color: "#D85A30",
    bg: "rgba(216,90,48,0.14)",
    border: "rgba(216,90,48,0.45)",
  };
}

function sentimentShift(clusters: LifecycleCluster[]): number {
  const rows = clusters
    .flatMap((c) => c.monthly ?? [])
    .filter((m) => typeof m.month === "string")
    .sort((a, b) => a.month.localeCompare(b.month));

  if (!rows.length) return 0;

  const firstMonth = rows[0].month;
  const lastMonth = rows[rows.length - 1].month;

  const firstVals = rows.filter((r) => r.month === firstMonth).map((r) => r.avg_sentiment);
  const lastVals = rows.filter((r) => r.month === lastMonth).map((r) => r.avg_sentiment);

  const firstAvg = firstVals.length ? firstVals.reduce((a, b) => a + b, 0) / firstVals.length : 0;
  const lastAvg = lastVals.length ? lastVals.reduce((a, b) => a + b, 0) / lastVals.length : 0;

  return Number((lastAvg - firstAvg).toFixed(3));
}

function moodLabel(sentiment: number, toxicity: number): string {
  if (sentiment > 0.1) return "curious/optimistic";
  if (sentiment < -0.3 && toxicity > 0.5) return "outrage/polarised";
  if (toxicity > 0.6) return "toxic/hostile";
  return "contested/mixed";
}

function clipped(text: string, max = 200): string {
  const compact = (text ?? "").replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

function peakPhase(phases: LifecyclePhase[]): LifecyclePhase | null {
  if (!phases.length) return null;
  return phases.reduce((best, cur) => (cur.post_count > best.post_count ? cur : best));
}

export default function LifecyclePage() {
  const { activeTopic } = useSignalStore();
  const [data, setData] = useState<LifecycleResponse>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lifecycle")
      .then((r) => r.json())
      .then((d) => setData(d as LifecycleResponse))
      .catch(() => setData(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  const allClusters = useMemo(() => data.lifecycle ?? [], [data.lifecycle]);

  const scopedClusters = useMemo(() => {
    if (activeTopic === null) return allClusters;
    return allClusters.filter((c) => c.topic_id === activeTopic);
  }, [allClusters, activeTopic]);

  const isScopeEmpty = activeTopic !== null && scopedClusters.length === 0;

  const clusters = isScopeEmpty ? allClusters : scopedClusters;

  const mostToxicClusterName = useMemo(() => {
    const match = (data.lifecycle ?? []).find((c) => c.topic_id === data.corpus_stats.most_toxic_cluster);
    return match?.name ?? `topic #${data.corpus_stats.most_toxic_cluster}`;
  }, [data.lifecycle, data.corpus_stats.most_toxic_cluster]);

  const shift = useMemo(() => sentimentShift(clusters), [clusters]);
  const shiftLabel = `${shift >= 0 ? "+" : ""}${shift.toFixed(3)}`;

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Narrative lifecycle</span>
        <span className="page-header__meta">sentiment arc · toxicity gradient · phase detection</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 24px 20px", display: "grid", gap: 12 }}>
        <StatRow
          stats={[
            {
              label: "AVG SENTIMENT",
              value: Number(data.corpus_stats.avg_sentiment.toFixed(3)),
              delta: data.corpus_stats.avg_sentiment < 0 ? "negative baseline" : "positive baseline",
              deltaColor: data.corpus_stats.avg_sentiment < 0 ? "var(--coral)" : "var(--teal)",
              mono: true,
            },
            {
              label: "MOST TOXIC CLUSTER",
              value: mostToxicClusterName,
              delta: `topic #${data.corpus_stats.most_toxic_cluster}`,
              mono: false,
            },
            {
              label: "SENTIMENT SHIFT",
              value: shiftLabel,
              delta: "first month to last month",
              deltaColor: shift < 0 ? "var(--coral)" : "var(--teal)",
              mono: true,
            },
            {
              label: "HIGH TOXICITY POSTS",
              value: data.corpus_stats.high_toxicity_count,
              delta: "toxicity > 0.7",
              deltaColor: "var(--amber)",
              mono: true,
            },
            {
              label: "RAGE AMPLIFICATION",
              value: `${data.corpus_stats.rage_amplification.toFixed(2)}x`,
              delta: "toxic vs civil upvotes",
              deltaColor: "var(--coral)",
              mono: true,
            },
          ]}
        />

        {!loading && isScopeEmpty && (
          <div
            style={{
              border: "1px solid rgba(186,117,23,0.4)",
              background: "rgba(186,117,23,0.08)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: "var(--amber)",
              fontFamily: "var(--font-mono)",
            }}
          >
            No lifecycle data for topic #{activeTopic}. Showing all available clusters.
          </div>
        )}

        {loading && (
          <div className="viz-panel" style={{ padding: 14 }}>
            <div className="shimmer" style={{ height: 120 }} />
          </div>
        )}

        {!loading && clusters.length === 0 && (
          <div className="viz-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              No lifecycle data for current topic filter.
            </div>
          </div>
        )}

        {clusters.map((cluster) => {
          const badge = toxicityBadge(cluster.avg_toxicity);
          return (
            <section
              key={cluster.topic_id}
              className="viz-panel"
              style={{
                padding: 12,
                display: "grid",
                gap: 12,
                borderColor: `${cluster.color}44`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cluster.color }} />
                  <span style={{ fontSize: 15, color: "var(--text)", fontWeight: 500 }}>
                    {cluster.name}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    topic #{cluster.topic_id}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: `1px solid ${badge.border}`,
                    background: badge.bg,
                    color: badge.color,
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {cluster.phases.map((phase) => {
                  const sentWidth = `${Math.min(100, Math.abs(phase.avg_sentiment) * 100)}%`;
                  const sentColor = phase.avg_sentiment < 0 ? "#D85A30" : "#1D9E75";
                  const toxWidth = `${Math.min(100, phase.avg_toxicity * 100)}%`;
                  const toxColor = toxicityScaleColor(phase.avg_toxicity);
                  const mood = moodLabel(phase.avg_sentiment, phase.avg_toxicity);

                  return (
                    <div key={`${cluster.topic_id}-${phase.phase}`} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", padding: "8px 10px", display: "grid", gap: 7 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text)" }}>{phase.phase}</div>
                        <div style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                          {phase.date_start} to {phase.date_end} · {phase.post_count} posts
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>sentiment {phase.avg_sentiment.toFixed(3)}</div>
                        <div style={{ height: 7, borderRadius: 999, background: "#0D1117", border: "1px solid var(--border)", overflow: "hidden" }}>
                          <div style={{ width: sentWidth, height: "100%", background: sentColor }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>toxicity {phase.avg_toxicity.toFixed(3)}</div>
                        <div style={{ height: 7, borderRadius: 999, background: "#0D1117", border: "1px solid var(--border)", overflow: "hidden" }}>
                          <div style={{ width: toxWidth, height: "100%", background: toxColor }} />
                        </div>
                      </div>

                      <div style={{ fontSize: 10, color: "var(--text-soft)", fontFamily: "var(--font-mono)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 8px", justifySelf: "start" }}>
                        {mood}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ border: "1px solid rgba(216,90,48,0.45)", borderRadius: 8, background: "rgba(216,90,48,0.08)", padding: "10px 12px", display: "grid", gap: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#D85A30", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>MOST TOXIC POST</span>
                    <span style={{ fontSize: 10, color: "#D85A30", border: "1px solid rgba(216,90,48,0.5)", borderRadius: 999, padding: "2px 7px", fontFamily: "var(--font-mono)" }}>
                      T:{cluster.most_toxic_post.toxicity.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-soft)", fontStyle: "italic", fontFamily: "var(--font-serif)", lineHeight: 1.6 }}>
                    "{clipped(cluster.most_toxic_post.text)}"
                  </div>
                  <div style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    u/{cluster.most_toxic_post.author} · r/{cluster.most_toxic_post.subreddit} · ↑ {cluster.most_toxic_post.score.toLocaleString()} · {cluster.most_toxic_post.date}
                  </div>
                </div>

                <div style={{ border: "1px solid rgba(29,158,117,0.45)", borderRadius: 8, background: "rgba(29,158,117,0.08)", padding: "10px 12px", display: "grid", gap: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#1D9E75", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>MOST VIRAL POST</span>
                    <span style={{ fontSize: 10, color: "#1D9E75", border: "1px solid rgba(29,158,117,0.5)", borderRadius: 999, padding: "2px 7px", fontFamily: "var(--font-mono)" }}>
                      ↑{cluster.most_viral_post.score.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-soft)", fontStyle: "italic", fontFamily: "var(--font-serif)", lineHeight: 1.6 }}>
                    "{clipped(cluster.most_viral_post.text)}"
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    <span>
                      u/{cluster.most_viral_post.author} · r/{cluster.most_viral_post.subreddit} · {cluster.most_viral_post.date}
                    </span>
                    <span>T:{cluster.most_viral_post.toxicity.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </section>
          );
        })}

        <section className="viz-panel" style={{ padding: 12, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            TOXICITY SCALE
          </div>
          <div style={{ height: 10, borderRadius: 999, border: "1px solid var(--border)", background: "linear-gradient(90deg, #1D9E75 0%, #BA7517 50%, #D85A30 100%)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
            <span>0.0 civil</span>
            <span>0.5 heated</span>
            <span>1.0 toxic</span>
          </div>
        </section>

        <section className="viz-panel" style={{ padding: 12, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                LEGACY LIFECYCLE SUMMARY
              </div>
              <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                Previous narrative lifecycle data (origin → acceleration → amplification → mutation), rendered inline.
              </div>
            </div>
            <a
              className="chip"
              href="/analysis/lifecycle"
              style={{ cursor: "pointer", textDecoration: "none" }}
            >
              Open full page
            </a>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {clusters.map((cluster) => {
              const first = cluster.monthly?.[0];
              const last = cluster.monthly?.[cluster.monthly.length - 1];
              const peak = peakPhase(cluster.phases);
              const toxDelta = (last?.avg_toxicity ?? 0) - (first?.avg_toxicity ?? 0);

              return (
                <div
                  key={`legacy-${cluster.topic_id}`}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    padding: "10px 12px",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: cluster.color }} />
                    <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{cluster.name}</span>
                    <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                      topic #{cluster.topic_id}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>ORIGIN</div>
                      <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 4 }}>
                        {first ? `${first.month} · ${first.post_count} posts` : "n/a"}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>ACCELERATION</div>
                      <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 4 }}>
                        {peak ? `${peak.phase} · ${peak.post_count} posts` : "n/a"}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>AMPLIFICATION</div>
                      <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 4 }}>
                        u/{cluster.most_viral_post.author} · ↑{cluster.most_viral_post.score.toLocaleString()}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>MUTATION</div>
                      <div style={{ fontSize: 11, color: toxDelta >= 0 ? "var(--coral)" : "var(--teal)", marginTop: 4 }}>
                        toxicity shift {toxDelta >= 0 ? "+" : ""}{toxDelta.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}
