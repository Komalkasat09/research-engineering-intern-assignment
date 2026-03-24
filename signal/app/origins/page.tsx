"use client";

import { useEffect, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { cleanTopicName } from "@/lib/cleanTopicName";

interface SpreadEntry {
  subreddit: string;
  days_after: number;
}

interface PostEntry {
  author: string;
  subreddit: string;
  text: string;
  date: string;
  score: number;
  post_id?: string;
}

interface ClusterOrigin {
  topic_id: number;
  name: string;
  color?: string;
  post_count?: number;
  origin_subreddit?: string;
  first_date?: string;
  spread?: SpreadEntry[];
  first_post?: PostEntry;
  top_post?: PostEntry;
  days_to_spread?: number;
  largest_subreddit?: string;
  time_to_mainstream_days?: number;
  mainstream_tier?: "instant" | "quick" | "gradual" | "niche";
  confidence_score?: number;
  confidence_label?: "high" | "medium" | "low";
}

interface OriginsResponse {
  clusters: ClusterOrigin[];
}

function fmtDate(value: string): string {
  if (!value || value === "unknown") return "unknown";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function cleanName(raw: string): string {
  return cleanTopicName(raw);
}

function confidenceColor(label: ClusterOrigin["confidence_label"]): string {
  if (label === "high") return "var(--teal)";
  if (label === "medium") return "var(--amber)";
  return "var(--coral)";
}

export default function OriginsPage() {
  const [clusters, setClusters] = useState<ClusterOrigin[]>([]);
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
        slowest: "—",
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
    const topOriginLabel = topOrigin !== "—" ? `r/${topOrigin.replace(/^r\//, "")}` : "—";

    const spreadDays = clusters
      .map((c) => c.days_to_spread ?? 0)
      .filter((d) => Number.isFinite(d) && d >= 0);

    const avgDays = spreadDays.length
      ? (spreadDays.reduce((a, b) => a + b, 0) / spreadDays.length).toFixed(1)
      : "—";

    // Fastest = lowest lag to first cross-subreddit spread event.
    const fastest = clusters.reduce((best, c) => {
      const days = c.spread?.[0]?.days_after ?? 999;
      const bestDays = best.spread?.[0]?.days_after ?? 999;
      return days < bestDays ? c : best;
    }, clusters[0]);

    // Slowest = highest lag to first cross-subreddit spread event.
    const slowest = clusters.reduce((worst, c) => {
      const days = c.spread?.[0]?.days_after ?? 0;
      const worstDays = worst.spread?.[0]?.days_after ?? 0;
      return days > worstDays ? c : worst;
    }, clusters[0]);

    return {
      earliestDate: dates[0] ? fmtDate(dates[0]) : "—",
      topOrigin: topOriginLabel,
      avgDays,
      fastest: fastest ? `${cleanName(fastest.name)} (+${fastest.spread?.[0]?.days_after ?? 0}d)` : "—",
      slowest: slowest ? `${cleanName(slowest.name)} (+${slowest.spread?.[0]?.days_after ?? 0}d)` : "—",
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

      <div style={{ padding: "12px 24px 0" }} suppressHydrationWarning>
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
              label: "Slowest to spread",
              value: loading ? "…" : stats.slowest,
              delta: "highest lag narrative",
              mono: true,
            },
          ]}
        />
      </div>

      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"0 24px 24px" }}>
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

        {clusters.map((cluster: ClusterOrigin) => (
          <div key={cluster.topic_id} style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            overflow:     "hidden",
            marginBottom: 10,
          }}>

            {/* ── Header ─────────────────────────────────── */}
            <div style={{
              padding:      "12px 16px",
              borderBottom: "1px solid var(--border)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "space-between",
              background:   (cluster.color ?? "#1D9E75") + "0d",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: cluster.color ?? "#1D9E75",
                }} />
                <span style={{ fontSize:14, fontWeight:500,
                               color:"var(--text)" }}>
                  {cleanName(cluster.name ?? "")}
                </span>
              </div>
              <span style={{ fontSize:11, color:"var(--dim)",
                             fontFamily:"var(--font-mono)" }}>
                {cluster.post_count ?? 0} posts
              </span>
            </div>

            <div style={{
              padding: "6px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#0D1117",
            }}>
              <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                evidence confidence
              </span>
              <span style={{
                fontSize: 10,
                color: confidenceColor(cluster.confidence_label),
                border: `1px solid ${confidenceColor(cluster.confidence_label)}44`,
                background: `${confidenceColor(cluster.confidence_label)}14`,
                borderRadius: 16,
                padding: "2px 7px",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: ".05em",
              }}>
                {cluster.confidence_label ?? "low"} ({(cluster.confidence_score ?? 0).toFixed(2)})
              </span>
            </div>

            {/* ── Origin + Spread ────────────────────────── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ padding:"10px 16px",
                            borderRight:"1px solid var(--border)" }}>
                <div style={{ fontSize:9, color:"var(--dim)",
                              letterSpacing:".1em", marginBottom:6,
                              fontFamily:"var(--font-mono)" }}>
                  ORIGIN
                </div>
                <div style={{ fontSize:13,
                              color: cluster.color ?? "#1D9E75",
                              fontFamily:"var(--font-mono)",
                              marginBottom:3 }}>
                  {cluster.origin_subreddit
                    ? `r/${cluster.origin_subreddit.replace(/^r\//,"")}`
                    : "unknown"}
                </div>
                <div style={{ fontSize:11, color:"var(--dim)",
                              fontFamily:"var(--font-mono)" }}>
                  {cluster.first_date ??
                   cluster.first_post?.date ?? "—"}
                </div>
              </div>
              <div style={{ padding:"10px 16px" }}>
                <div style={{ fontSize:9, color:"var(--dim)",
                              letterSpacing:".1em", marginBottom:6,
                              fontFamily:"var(--font-mono)" }}>
                  SPREAD TO
                </div>
                {(cluster.spread ?? []).length > 0
                  ? (cluster.spread ?? []).slice(0,3).map(
                      (s: {subreddit:string; days_after:number}) => (
                      <div key={s.subreddit} style={{
                        fontSize:11, color:"var(--text-soft)",
                        marginBottom:3,
                        fontFamily:"var(--font-mono)",
                      }}>
                        r/{s.subreddit.replace(/^r\//,"")}
                        <span style={{ color:"var(--dim)",
                                       marginLeft:6 }}>
                          +{s.days_after}d
                        </span>
                      </div>
                    ))
                  : <div style={{ fontSize:11, color:"var(--muted)",
                                   fontFamily:"var(--font-mono)" }}>
                      single subreddit
                    </div>
                }

                <div style={{ marginTop: 8, fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  mainstream: r/{(cluster.largest_subreddit ?? "unknown").replace(/^r\//, "")} ·
                  {" "}TTM {cluster.time_to_mainstream_days ?? 0}d · {cluster.mainstream_tier ?? "niche"}
                </div>
              </div>
            </div>

            {/* ── First post ─────────────────────────────── */}
            {cluster.first_post?.text && (
              <div style={{ padding:"10px 16px",
                            borderBottom:"1px solid var(--border)" }}>
                <div style={{ fontSize:9, color:"var(--dim)",
                              letterSpacing:".1em", marginBottom:6,
                              fontFamily:"var(--font-mono)" }}>
                  FIRST POST
                </div>
                <div style={{ fontSize:12, color:"var(--text-soft)",
                              fontFamily:"var(--font-serif)",
                              fontStyle:"italic", lineHeight:1.7,
                              marginBottom:6 }}>
                  "{cluster.first_post.text.slice(0, 240)}
                  {cluster.first_post.text.length > 240 ? "…" : ""}"
                </div>
                <div style={{ fontSize:10, color:"var(--muted)",
                              fontFamily:"var(--font-mono)" }}>
                  u/{cluster.first_post.author} ·
                  r/{(cluster.first_post.subreddit ?? "")
                      .replace(/^r\//,"")} ·
                  ↑ {cluster.first_post.score} ·
                  {cluster.first_post.date}
                </div>
              </div>
            )}

            {/* ── Top post ───────────────────────────────── */}
            {cluster.top_post?.text &&
             cluster.top_post.text !== cluster.first_post?.text && (
              <div style={{ padding:"10px 16px" }}>
                <div style={{ fontSize:9, color:"var(--dim)",
                              letterSpacing:".1em", marginBottom:6,
                              fontFamily:"var(--font-mono)" }}>
                  TOP POST (highest engagement)
                </div>
                <div style={{ fontSize:12, color:"var(--text-soft)",
                              fontFamily:"var(--font-serif)",
                              fontStyle:"italic", lineHeight:1.7,
                              marginBottom:6 }}>
                  "{cluster.top_post.text.slice(0, 240)}
                  {cluster.top_post.text.length > 240 ? "…" : ""}"
                </div>
                <div style={{ fontSize:10, color:"var(--muted)",
                              fontFamily:"var(--font-mono)" }}>
                  u/{cluster.top_post.author} ·
                  r/{(cluster.top_post.subreddit ?? "")
                      .replace(/^r\//,"")} ·
                  ↑ {cluster.top_post.score} ·
                  {cluster.top_post.date}
                </div>
              </div>
            )}

          </div>
        ))}
      </div>
    </Shell>
  );
}
