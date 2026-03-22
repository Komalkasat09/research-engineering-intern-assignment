"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { cleanTopicName } from "@/lib/cleanTopicName";

interface OriginPost {
  post_id?: string;
  author: string;
  subreddit: string;
  text: string;
  date: string;
  score: number;
}

interface SpreadPoint {
  subreddit: string;
  days_after: number;
}

interface OriginCluster {
  topic_id: number;
  name: string;
  color: string;
  post_count?: number;
  first_date?: string;
  first_post: OriginPost;
  origin_subreddit: string;
  days_to_spread: number;
  spread_to: string[];
  spread?: SpreadPoint[];
  spread_detail?: SpreadPoint[];
  top_post: OriginPost;
  earliest_posts: OriginPost[];
}

interface OriginsResponse {
  clusters: OriginCluster[];
}

function fmtDate(value: string): string {
  if (!value || value === "unknown") return "unknown";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function OriginsPage() {
  const [clusters, setClusters] = useState<OriginCluster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/origins")
      .then((r) => r.json())
      .then((d: OriginsResponse) => setClusters(d.clusters ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!clusters.length) {
      return {
        earliestDate: "—",
        topOrigin: "—",
        avgDays: "—",
        fastest: "—",
      };
    }

    const dates = clusters
      .map((c) => c.first_post?.date)
      .filter((d): d is string => Boolean(d && d !== "unknown"))
      .sort();

    const originCounts = new Map<string, number>();
    for (const c of clusters) {
      const key = c.origin_subreddit || "r/unknown";
      originCounts.set(key, (originCounts.get(key) ?? 0) + 1);
    }
    const topOrigin = [...originCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    const spreadDays = clusters
      .map((c) => c.days_to_spread)
      .filter((d) => Number.isFinite(d) && d >= 0);

    const avgDays = spreadDays.length
      ? (spreadDays.reduce((a, b) => a + b, 0) / spreadDays.length).toFixed(1)
      : "—";

    const fastestCluster = [...clusters]
      .filter((c) => Number.isFinite(c.days_to_spread))
      .sort((a, b) => a.days_to_spread - b.days_to_spread)[0];

    return {
      earliestDate: dates[0] ? fmtDate(dates[0]) : "—",
      topOrigin,
      avgDays,
      fastest: fastestCluster ? `${cleanTopicName(fastestCluster.name)} (+${fastestCluster.days_to_spread}d)` : "—",
    };
  }, [clusters]);

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Narrative origins</span>
        <span className="page-header__meta">
          who said it first · temporal spread analysis
        </span>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Earliest post",
              value: loading ? "…" : stats.earliestDate,
              delta: "first dated framing",
              mono: true,
            },
            {
              label: "Top origin",
              value: loading ? "…" : stats.topOrigin,
              delta: "most cluster first-movers",
              mono: true,
            },
            {
              label: "Avg days to spread",
              value: loading ? "…" : stats.avgDays,
              delta: "until second subreddit",
              mono: true,
            },
            {
              label: "Fastest spread",
              value: loading ? "…" : stats.fastest,
              delta: "lowest lag narrative",
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
          overflowY: "auto",
        }}
      >
        {loading && (
          <div className="shimmer" style={{ height: 220, borderRadius: "var(--radius-md)" }} />
        )}

        {!loading && clusters.length === 0 && (
          <div className="viz-panel" style={{ padding: 16 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              No origins data available.
            </span>
          </div>
        )}

        {!loading && clusters.map((cluster) => {
          const spread = (cluster.spread ?? cluster.spread_detail ?? []).slice(0, 3);
          const firstDate = cluster.first_date ?? cluster.first_post?.date ?? "—";
          const showTopPost =
            Boolean(cluster.top_post) &&
            (
              (cluster.top_post.post_id && cluster.top_post.post_id !== cluster.first_post?.post_id) ||
              cluster.top_post.text !== cluster.first_post?.text ||
              cluster.top_post.author !== cluster.first_post?.author ||
              cluster.top_post.date !== cluster.first_post?.date
            );

          return (
            <div
              key={cluster.topic_id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: cluster.color + "0a",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cluster.color }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                    {cleanTopicName(cluster.name)}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  {cluster.post_count ?? "—"} posts
                </span>
              </div>

              {/* Origin + Spread row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ padding: "10px 16px", borderRight: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                    ORIGIN
                  </div>
                  <div style={{ fontSize: 13, color: cluster.color, fontFamily: "var(--font-mono)", marginBottom: 3 }}>
                    {cluster.origin_subreddit ?? "unknown"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    {fmtDate(firstDate)}
                  </div>
                </div>

                <div style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                    SPREAD TO
                  </div>
                  {spread.map((s) => (
                    <div key={s.subreddit} style={{ fontSize: 11, color: "var(--text-soft)", marginBottom: 2, fontFamily: "var(--font-mono)" }}>
                      {s.subreddit}
                      <span style={{ color: "var(--dim)", marginLeft: 6 }}>
                        +{s.days_after}d
                      </span>
                    </div>
                  ))}
                  {spread.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      single subreddit
                    </div>
                  )}
                </div>
              </div>

              {/* First post */}
              {cluster.first_post && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                    FIRST POST
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", fontFamily: "var(--font-serif)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 6 }}>
                    "{cluster.first_post.text?.slice(0, 200)}
                    {(cluster.first_post.text?.length ?? 0) > 200 ? "…" : ""}"
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {cluster.first_post.author} · r/{cluster.first_post.subreddit} · ↑ {cluster.first_post.score} · {cluster.first_post.date}
                  </div>
                </div>
              )}

              {/* Top post */}
              {showTopPost && cluster.top_post && (
                <div style={{ padding: "10px 16px" }}>
                  <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: ".1em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                    TOP POST (highest engagement)
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", fontFamily: "var(--font-serif)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 6 }}>
                    "{cluster.top_post.text?.slice(0, 200)}
                    {(cluster.top_post.text?.length ?? 0) > 200 ? "…" : ""}"
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {cluster.top_post.author} · r/{cluster.top_post.subreddit} · ↑ {cluster.top_post.score} · {cluster.top_post.date}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
