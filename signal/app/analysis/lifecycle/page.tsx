"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import type { TopicCluster, VelocityPoint } from "@/types";

type StageStatus = "CONFIRMED" | "LIKELY" | "INSUFFICIENT DATA";

interface OriginCluster {
  topic_id: number;
  name: string;
  post_count: number;
  origin_subreddit: string;
  first_post: {
    date: string;
    created_utc: number;
    subreddit?: string;
  };
  spread: Array<{ subreddit: string; days_after: number }>;
  earliest_posts?: Array<{ subreddit: string; created_utc: number }>;
  confidence_label?: "high" | "medium" | "low";
}

interface GraphNode {
  id: string;
  label: string;
  type: "account" | "subreddit";
  weight: number;
  topic_id: number;
  post_count: number;
}

interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

interface CoordPair {
  account_a: string;
  account_b: string;
  sync_count: number;
  avg_gap_min: number;
  confidence_label?: "high" | "medium" | "low";
}

interface NarrativeDiffEntry {
  topic_id: number;
  added: Array<{ term: string; count: number }>;
  dropped: Array<{ term: string; count: number }>;
}

function parseWeekToDate(week: string): Date {
  if (week.includes("/")) {
    const start = new Date(week.split("/")[0]);
    return Number.isNaN(start.getTime()) ? new Date(0) : start;
  }

  const [yearRaw, weekRaw] = week.split("-W");
  const year = Number(yearRaw);
  const w = Number(weekRaw);

  if (Number.isFinite(year) && Number.isFinite(w)) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - day + 1 + (w - 1) * 7);
    return monday;
  }

  const fallback = new Date(week);
  return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

function toConfidenceBadge(status: StageStatus) {
  if (status === "CONFIRMED") {
    return { color: "#1D9E75", bg: "rgba(29,158,117,0.13)", border: "rgba(29,158,117,0.45)" };
  }
  if (status === "LIKELY") {
    return { color: "#BA7517", bg: "rgba(186,117,23,0.16)", border: "rgba(186,117,23,0.45)" };
  }
  return { color: "#D85A30", bg: "rgba(216,90,48,0.13)", border: "rgba(216,90,48,0.45)" };
}

function StageCard({
  index,
  title,
  subtitle,
  status,
  children,
}: {
  index: number;
  title: string;
  subtitle: string;
  status: StageStatus;
  children: React.ReactNode;
}) {
  const badge = toConfidenceBadge(status);

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            STAGE {index}
          </div>
          <h3 style={{ margin: "2px 0 0", fontSize: 18, color: "var(--strong)", letterSpacing: "-0.01em" }}>{title}</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-soft)" }}>{subtitle}</p>
        </div>

        <span
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            color: badge.color,
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            whiteSpace: "nowrap",
          }}
        >
          {status}
        </span>
      </div>
      {children}
    </section>
  );
}

function MiniAmplificationGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const width = 760;
  const height = 180;

  const topAccounts = nodes.filter((n) => n.type === "account").slice(0, 5);
  const involvedIds = new Set(topAccounts.map((n) => n.id));

  for (const link of links) {
    if (involvedIds.has(link.source)) involvedIds.add(link.target);
    if (involvedIds.has(link.target)) involvedIds.add(link.source);
  }

  const subNodes = nodes.filter((n) => involvedIds.has(n.id)).slice(0, 11);
  const subLinks = links.filter((l) => involvedIds.has(l.source) && involvedIds.has(l.target)).slice(0, 18);

  if (!subNodes.length) {
    return <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>No graph structure for this topic.</div>;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.36;

  const pos = new Map<string, { x: number; y: number }>();
  subNodes.forEach((node, i) => {
    const angle = (i / subNodes.length) * Math.PI * 2;
    const r = node.type === "account" ? radius * 0.72 : radius;
    pos.set(node.id, {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    });
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ border: "1px solid var(--border)", borderRadius: 8, background: "#0A0C0E" }}>
      {subLinks.map((link, idx) => {
        const s = pos.get(link.source);
        const t = pos.get(link.target);
        if (!s || !t) return null;
        return <line key={`l-${idx}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(138,155,176,0.35)" strokeWidth={1 + Math.min(2, Number(link.weight) / 4)} />;
      })}

      {subNodes.map((node) => {
        const p = pos.get(node.id);
        if (!p) return null;
        const r = node.type === "account" ? 4 : 6;
        const fill = node.type === "account" ? "#1D9E75" : "#7F77DD";
        return (
          <g key={node.id}>
            <circle cx={p.x} cy={p.y} r={r} fill={fill} />
            <text x={p.x + 7} y={p.y + 3} fill="#8A9BB0" fontSize={10} fontFamily="var(--font-mono)">
              {node.label.replace(/^u\//, "").replace(/^r\//, "").slice(0, 14)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function NarrativeLifecyclePage() {
  const router = useRouter();
  const { activeTopic } = useSignalStore();

  const [hydrated, setHydrated] = useState(false);
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [origins, setOrigins] = useState<OriginCluster[]>([]);
  const [velocity, setVelocity] = useState<VelocityPoint[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [coordPairs, setCoordPairs] = useState<CoordPair[]>([]);
  const [diffs, setDiffs] = useState<NarrativeDiffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const topicId = hydrated ? activeTopic : null;

  useEffect(() => {
    Promise.all([
      fetch("/api/clusters").then((r) => r.json()),
      fetch("/api/origins").then((r) => r.json()),
      fetch("/api/velocity").then((r) => r.json()),
      topicId !== null
        ? fetch(`/api/graph?topic_id=${topicId}&limit=300`).then((r) => r.json())
        : Promise.resolve({ nodes: [], links: [] }),
      fetch("/api/coord").then((r) => r.json()),
      fetch("/api/narrative-diff").then((r) => r.json()),
    ])
      .then(([clusterRes, originsRes, velocityRes, graphRes, coordRes, diffRes]) => {
        setClusters((clusterRes.topics ?? []) as TopicCluster[]);
        setOrigins((originsRes.clusters ?? []) as OriginCluster[]);
        setVelocity((velocityRes ?? []) as VelocityPoint[]);
        setGraphData({ nodes: (graphRes.nodes ?? []) as GraphNode[], links: (graphRes.links ?? []) as GraphLink[] });
        setCoordPairs((coordRes.top_pairs ?? []) as CoordPair[]);
        setDiffs((diffRes.diffs ?? []) as NarrativeDiffEntry[]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [topicId]);

  const topic = useMemo(() => clusters.find((c) => c.id === topicId) ?? null, [clusters, topicId]);

  const origin = useMemo(
    () => (topicId === null ? null : origins.find((o) => o.topic_id === topicId) ?? null),
    [origins, topicId],
  );

  const velocityRows = useMemo(() => {
    if (topicId === null) return [] as VelocityPoint[];
    return velocity
      .filter((v) => v.topic_id === topicId)
      .sort((a, b) => parseWeekToDate(a.week).getTime() - parseWeekToDate(b.week).getTime());
  }, [velocity, topicId]);

  const acceleration = useMemo(() => {
    if (velocityRows.length < 2) {
      return {
        spikeIdx: -1,
        spikeWeek: "unknown",
        spikeDelta: 0,
        pre: 0,
        post: 0,
      };
    }

    let bestDelta = -Infinity;
    let bestIdx = 1;

    for (let i = 1; i < velocityRows.length; i++) {
      const d = Number(velocityRows[i].velocity) - Number(velocityRows[i - 1].velocity);
      if (d > bestDelta) {
        bestDelta = d;
        bestIdx = i;
      }
    }

    const start = Math.max(0, bestIdx - 4);
    const end = Math.min(velocityRows.length, bestIdx + 4);
    const preWindow = velocityRows.slice(start, bestIdx).map((d) => Number(d.velocity));
    const postWindow = velocityRows.slice(bestIdx, end).map((d) => Number(d.velocity));
    const pre = preWindow.length ? preWindow.reduce((a, b) => a + b, 0) / preWindow.length : 0;
    const post = postWindow.length ? postWindow.reduce((a, b) => a + b, 0) / postWindow.length : 0;

    return {
      spikeIdx: bestIdx,
      spikeWeek: velocityRows[bestIdx].week,
      spikeDelta: bestDelta,
      pre,
      post,
    };
  }, [velocityRows]);

  const topAccounts = useMemo(() => {
    const accounts = graphData.nodes
      .filter((n) => n.type === "account")
      .sort((a, b) => (Number(b.weight) * (b.post_count ?? 0)) - (Number(a.weight) * (a.post_count ?? 0)))
      .slice(0, 5);
    return accounts;
  }, [graphData.nodes]);

  const coordinationFlag = useMemo(() => {
    if (!topAccounts.length || !coordPairs.length) return false;
    const accountIds = new Set(topAccounts.map((a) => a.id));
    return coordPairs.some((p) => {
      const highish = p.confidence_label === "high" || Number(p.sync_count) >= 8;
      return highish && (accountIds.has(p.account_a) || accountIds.has(p.account_b));
    });
  }, [topAccounts, coordPairs]);

  const topicDiff = useMemo(
    () => (topicId === null ? null : diffs.find((d) => d.topic_id === topicId) ?? null),
    [diffs, topicId],
  );

  const originConcentration = useMemo(() => {
    if (!origin) return null;
    const samples = [origin.first_post?.subreddit, ...(origin.earliest_posts ?? []).map((p) => p.subreddit)].filter(Boolean) as string[];
    if (!samples.length) return { score: 1, label: "high concentration" };

    const counts = new Map<string, number>();
    for (const s of samples) counts.set(s, (counts.get(s) ?? 0) + 1);

    const total = samples.length;
    let hhi = 0;
    for (const c of counts.values()) {
      const share = c / total;
      hhi += share * share;
    }

    let label = "diverse";
    if (hhi >= 0.5) label = "high concentration";
    else if (hhi >= 0.32) label = "moderate concentration";

    return { score: hhi, label };
  }, [origin]);

  const originStatus: StageStatus = origin
    ? (origin.earliest_posts?.length ?? 0) >= 3 ? "CONFIRMED" : "LIKELY"
    : "INSUFFICIENT DATA";

  const accelerationStatus: StageStatus = velocityRows.length >= 10
    ? "CONFIRMED"
    : velocityRows.length >= 4 ? "LIKELY" : "INSUFFICIENT DATA";

  const amplificationStatus: StageStatus = topAccounts.length >= 5 && graphData.links.length > 0
    ? "CONFIRMED"
    : topAccounts.length > 0 ? "LIKELY" : "INSUFFICIENT DATA";

  const mutationStatus: StageStatus = topicDiff
    ? (topicDiff.added.length >= 3 && topicDiff.dropped.length >= 3 ? "CONFIRMED" : "LIKELY")
    : "INSUFFICIENT DATA";

  const spikeContextNote = useMemo(() => {
    if (!origin || acceleration.spikeIdx < 0) return "Insufficient sequence data to annotate spike cause.";
    const spikeDate = parseWeekToDate(acceleration.spikeWeek).getTime() / 1000;
    const firstTs = Number(origin.first_post?.created_utc ?? 0);
    const joined = (origin.spread ?? []).find((s) => {
      const approxTs = firstTs + (Number(s.days_after) * 86400);
      return Math.abs(approxTs - spikeDate) <= 9 * 86400;
    });

    if (joined && coordinationFlag) {
      return `Spike coincides with expansion into ${joined.subreddit} and elevated coordinated posting signals.`;
    }
    if (joined) {
      return `Spike aligns with a new community joining: ${joined.subreddit}.`;
    }
    if (coordinationFlag) {
      return "Spike period shows likely coordinated amplification among top spread accounts.";
    }
    return "Spike appears driven by organic momentum lift without a strong coordination signature.";
  }, [origin, acceleration, coordinationFlag]);

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Narrative lifecycle</span>
        <span className="page-header__meta">origin → acceleration → amplification → mutation</span>
        {topic && (
          <span style={{ fontSize: 11, color: "var(--teal)", fontFamily: "var(--font-mono)", marginLeft: 4 }}>
            · topic #{topic.id} — {cleanTopicName(topic.name)}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 24px 20px", display: "grid", gap: 12 }}>
        {!loading && topicId === null && (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              padding: 18,
              display: "grid",
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, color: "var(--strong)", fontSize: 18 }}>Select a narrative first</h3>
            <p style={{ margin: 0, color: "var(--text-soft)", fontSize: 13 }}>
              Pick a topic from Explore to populate the lifecycle stages for one narrative.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="chip active" style={{ border: "none", cursor: "pointer" }} onClick={() => router.push("/explore")}>Open Explore</button>
            </div>
          </div>
        )}

        {(loading || topicId !== null) && (
          <>
            <StageCard
              index={1}
              title="Origin"
              subtitle="First communities and source concentration"
              status={originStatus}
            >
              {origin ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                    <div className="stat-card">
                      <div className="stat-card__label">first seen</div>
                      <div className="stat-card__value" style={{ fontSize: 18 }}>{origin.first_post?.date ?? "unknown"}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__label">origin community</div>
                      <div className="stat-card__value" style={{ fontSize: 18 }}>{origin.origin_subreddit}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__label">source concentration</div>
                      <div className="stat-card__value" style={{ fontSize: 18 }}>
                        {originConcentration ? `${(originConcentration.score * 100).toFixed(0)}%` : "n/a"}
                      </div>
                      <div className="stat-card__delta">{originConcentration?.label ?? "unknown"}</div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>first communities</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[origin.origin_subreddit, ...(origin.spread ?? []).map((s) => s.subreddit)]
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .slice(0, 8)
                        .map((sub) => (
                          <span key={sub} className="chip active">{sub}</span>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>No origin record for current topic.</div>
              )}
            </StageCard>

            <StageCard
              index={2}
              title="Acceleration"
              subtitle="Velocity inflection and what changed"
              status={accelerationStatus}
            >
              {velocityRows.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: "var(--surface-2)" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
                      spike week: {acceleration.spikeWeek} · delta +{Math.max(0, acceleration.spikeDelta).toFixed(3)}
                    </div>
                    <svg width="100%" height="120" viewBox="0 0 760 120">
                      <polyline
                        fill="none"
                        stroke="#1D9E75"
                        strokeWidth="2"
                        points={velocityRows
                          .map((d, i) => {
                            const x = (i / Math.max(1, velocityRows.length - 1)) * 760;
                            const y = 110 - (Number(d.velocity) / Math.max(0.0001, ...velocityRows.map((r) => Number(r.velocity)))) * 90;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                      {acceleration.spikeIdx >= 0 && (
                        <line
                          x1={(acceleration.spikeIdx / Math.max(1, velocityRows.length - 1)) * 760}
                          y1={10}
                          x2={(acceleration.spikeIdx / Math.max(1, velocityRows.length - 1)) * 760}
                          y2={112}
                          stroke="#BA7517"
                          strokeDasharray="4 4"
                        />
                      )}
                    </svg>
                  </div>

                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>annotation</div>
                    <div style={{ fontSize: 13, color: "var(--text-soft)" }}>{spikeContextNote}</div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>No velocity data for current topic.</div>
              )}
            </StageCard>

            <StageCard
              index={3}
              title="Amplification"
              subtitle="Top spread drivers and coordination risk"
              status={amplificationStatus}
            >
              {topAccounts.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8 }}>
                    {topAccounts.map((a, idx) => (
                      <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "var(--surface-2)" }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>#{idx + 1}</div>
                        <div style={{ fontSize: 13, color: "var(--strong)" }}>{a.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-soft)", fontFamily: "var(--font-mono)" }}>
                          posts {a.post_count.toLocaleString()} · centrality {Number(a.weight).toFixed(3)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <MiniAmplificationGraph nodes={graphData.nodes} links={graphData.links} />

                  <div
                    style={{
                      border: `1px solid ${coordinationFlag ? "rgba(216,90,48,0.45)" : "var(--border)"}`,
                      borderRadius: 8,
                      padding: "8px 10px",
                      background: coordinationFlag ? "rgba(216,90,48,0.1)" : "var(--surface-2)",
                      fontSize: 12,
                      color: coordinationFlag ? "#D85A30" : "var(--text-soft)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    coordination flag: {coordinationFlag ? "likely synchronized amplification detected" : "no clear coordinated burst for top amplifiers"}
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>No amplification nodes for current topic.</div>
              )}
            </StageCard>

            <StageCard
              index={4}
              title="Mutation"
              subtitle="Language drift snapshots and late-arriving markers"
              status={mutationStatus}
            >
              {topicDiff ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px", background: "var(--surface-2)" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>early snapshot</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {topicDiff.dropped.slice(0, 6).map((w) => (
                          <span key={`e-${w.term}`} className="chip">{w.term}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px", background: "var(--surface-2)" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>mid snapshot</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {[...topicDiff.dropped.slice(0, 3), ...topicDiff.added.slice(0, 3)].map((w) => (
                          <span key={`m-${w.term}`} className="chip">{w.term}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px", background: "var(--surface-2)" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>late snapshot</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {topicDiff.added.slice(0, 6).map((w) => (
                          <span key={`l-${w.term}`} style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, border: "1px solid rgba(216,90,48,0.5)", color: "#D85A30", background: "rgba(216,90,48,0.12)", fontFamily: "var(--font-mono)" }}>
                            {w.term}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                      mutation markers (late arrivals)
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-soft)" }}>
                      {topicDiff.added.slice(0, 8).map((w) => w.term).join(", ") || "none"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>No narrative-diff snapshots for current topic.</div>
              )}
            </StageCard>
          </>
        )}
      </div>
    </Shell>
  );
}
