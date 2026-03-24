"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignalStore } from "@/lib/store";

const TOPIC_COLORS: Record<number, string> = {
  0: "#1D9E75", 1: "#7F77DD", 2: "#D85A30", 3: "#BA7517",
  4: "#378ADD", 5: "#D4537E", 6: "#639922", 7: "#888780",
};

interface TopicProfile {
  topic_id: number;
  name: string;
  color: string;
  count: number;
}

interface Post {
  post_id: string;
  text: string;
  subreddit: string;
  date: string;
  score: number;
  topic_id: number;
  topic_name: string;
}

interface AccountData {
  id: string;
  post_count: number;
  topic_profile: TopicProfile[];
  is_bridge: boolean;
  posts: Post[];
  note?: string;
}

type Tab = "overview" | "posts" | "network";

interface Connection {
  id: string;
  label: string;
  weight: number;
  color: string;
}

interface Props {
  nodeId: string | null;
  nodeType?: string;
  nodeCommunity?: number;
  nodeWeight?: number;
  nodePostCount?: number;
  connections?: Connection[];
  onClose: () => void;
}

export default function NodeDetailPanel({
  nodeId, nodeType, nodeCommunity, nodeWeight,
  nodePostCount, connections = [], onClose,
}: Props) {
  const router = useRouter();
  const { setActiveTopic, setInvestigationContext } = useSignalStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) return;
    setData(null);
    setTab("overview");
    setLoading(true);
    fetch(`/api/account/${encodeURIComponent(nodeId)}`)
      .then((r) => r.json())
      .then((d) => setData(d as AccountData))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [nodeId]);

  if (!nodeId) return null;

  const initials = nodeId.slice(0, 2).toUpperCase();
  const dominantTopic = data?.topic_profile?.[0];
  const dominantColor = dominantTopic
    ? TOPIC_COLORS[dominantTopic.topic_id] ?? "#5A8A9F"
    : nodeType === "subreddit" ? "#378ADD" : "#5A7A8A";

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 300,
        background: "#0A1018",
        border: "1px solid #1E2B3A",
        borderRadius: 12,
        overflow: "hidden",
        zIndex: 30,
        animation: "slideIn 0.18s ease",
        maxHeight: "calc(100% - 24px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(10px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid #0D1A22",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: dominantColor + "22",
              border: `1px solid ${dominantColor}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: dominantColor,
              flexShrink: 0,
              fontWeight: 500,
              fontFamily: "var(--font-mono)",
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0", fontFamily: "var(--font-mono)" }}>
              {nodeId.length > 20 ? nodeId.slice(0, 18) + "…" : nodeId}
            </div>
            <div style={{ fontSize: 10, color: "#2A3A45", marginTop: 2, fontFamily: "var(--font-mono)" }}>
              {nodeType ?? "account"} · community {nodeCommunity ?? "—"}
              {dominantTopic ? ` · ${dominantTopic.name}` : ""}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#2A3A45",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid #0D1A22", flexShrink: 0 }}>
        {(["overview", "posts", "network"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              fontSize: 10,
              letterSpacing: ".08em",
              textAlign: "center",
              color: tab === t ? "#1D9E75" : "#2A3A45",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "#1D9E75" : "transparent"}`,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              transition: "all .15s",
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 1,
            background: "#0D1A22",
          }}
        >
          {[
            { label: "POSTS", val: loading ? "…" : String(data?.post_count ?? nodePostCount ?? "—"), sub: "in dataset" },
            { label: "PAGERANK", val: nodeWeight ? nodeWeight.toFixed(4) : "—", sub: "influence" },
            { label: "CONNECTIONS", val: String(connections.length), sub: "subreddits" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#070A0D", padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: "#2A3A45", letterSpacing: ".08em", marginBottom: 3, fontFamily: "var(--font-mono)" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 16, color: "#E2E8F0", letterSpacing: "-.02em", fontFamily: "var(--font-mono)" }}>
                {s.val}
              </div>
              <div style={{ fontSize: 9, color: "#4A6A7A", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {tab === "overview" && (
          <div>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #0D1A22" }}>
              <div style={{ fontSize: 9, color: "#2A3A45", letterSpacing: ".1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                NARRATIVE PROFILE
              </div>
              {loading && (
                <div style={{ fontSize: 11, color: "#2A3A45", fontFamily: "var(--font-mono)" }}>loading…</div>
              )}
              {!loading && (data?.topic_profile?.length ?? 0) === 0 && (
                <div style={{ fontSize: 11, color: "#2A3A45", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>
                  {data?.note ?? "No topic data available. Run the pipeline to see narrative profile."}
                </div>
              )}
              {!loading && (data?.topic_profile ?? []).map((tp) => (
                <div
                  key={tp.topic_id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 9px",
                    borderRadius: 12,
                    background: tp.color + "14",
                    border: `1px solid ${tp.color}33`,
                    color: tp.color,
                    fontSize: 10,
                    marginBottom: 4,
                    marginRight: 4,
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                  }}
                  onClick={() => setActiveTopic(tp.topic_id)}
                  title="Click to filter all views to this topic"
                >
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: tp.color, flexShrink: 0 }} />
                  {tp.name} — {tp.count}
                </div>
              ))}

              {data?.is_bridge && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "7px 10px",
                    background: "rgba(212,160,23,0.08)",
                    border: "1px solid rgba(212,160,23,0.2)",
                    borderRadius: 6,
                    fontSize: 10,
                    color: "#BA7517",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Cross-topic poster — participates in {data.topic_profile.length} narrative clusters.
                  May be a narrative bridge account.
                </div>
              )}
            </div>

            {!loading && (data?.posts?.length ?? 0) > 0 && (
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #0D1A22" }}>
                <div style={{ fontSize: 9, color: "#2A3A45", letterSpacing: ".1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                  TOP POST
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "#1D9E75", fontFamily: "var(--font-mono)" }}>
                      r/{data!.posts[0].subreddit}
                    </span>
                    <span style={{ fontSize: 9, color: "#2A3A45", fontFamily: "var(--font-mono)" }}>
                      {data!.posts[0].date}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8A9BB0", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                    "{data!.posts[0].text.slice(0, 160)}{data!.posts[0].text.length > 160 ? "…" : ""}"
                  </div>
                  <div style={{ fontSize: 9, color: "#3A5A6A", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                    ↑ {data!.posts[0].score} · {data!.posts[0].topic_name}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "posts" && (
          <div style={{ padding: "0 16px" }}>
            {loading && (
              <div style={{ padding: "16px 0", fontSize: 11, color: "#2A3A45", fontFamily: "var(--font-mono)" }}>
                loading posts…
              </div>
            )}
            {!loading && (data?.posts?.length ?? 0) === 0 && (
              <div style={{ padding: "16px 0", fontSize: 11, color: "#2A3A45", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                {data?.note ?? "No posts found. Run scripts/07_index.py to index post content."}
              </div>
            )}
            {!loading && (data?.posts ?? []).map((post, i) => (
              <div
                key={post.post_id}
                style={{
                  padding: "10px 0",
                  borderBottom: i < (data!.posts.length - 1) ? "1px solid #0D1A22" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 9, color: "#1D9E75", fontFamily: "var(--font-mono)" }}>
                    r/{post.subreddit}
                  </span>
                  <span style={{ fontSize: 9, color: "#2A3A45", fontFamily: "var(--font-mono)" }}>
                    {post.date}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#A0B0C0", lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                  {post.text}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                  <span style={{ fontSize: 9, color: "#3A5A6A", fontFamily: "var(--font-mono)" }}>
                    ↑ {post.score}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: TOPIC_COLORS[post.topic_id] ?? "#888",
                      fontFamily: "var(--font-mono)",
                      cursor: "pointer",
                    }}
                    onClick={() => post.topic_id >= 0 && setActiveTopic(post.topic_id)}
                  >
                    {post.topic_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "network" && (
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 9, color: "#2A3A45", letterSpacing: ".1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
              CONNECTED SUBREDDITS
            </div>
            {connections.length === 0 && (
              <div style={{ fontSize: 11, color: "#2A3A45", fontFamily: "var(--font-sans)" }}>
                No connection data available.
              </div>
            )}
            {connections.map((conn) => (
              <div
                key={conn.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  borderBottom: "1px solid #0A1318",
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: conn.color, flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: "#6A8A9A", flex: 1, fontFamily: "var(--font-mono)" }}>
                  {conn.label}
                </div>
                <div style={{ fontSize: 9, color: "#2A3A45", fontFamily: "var(--font-mono)" }}>
                  {conn.weight}×
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #0D1A22" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                setInvestigationContext({
                  source: "graph",
                  topicId: dominantTopic?.topic_id ?? null,
                  narrativeName: dominantTopic?.name,
                  note: `Drillthrough from graph node ${nodeId}`,
                  createdAt: Date.now(),
                });
                if (dominantTopic?.topic_id !== undefined) setActiveTopic(dominantTopic.topic_id);
                router.push("/map");
              }}
              className="chip"
              style={{ border: "none", background: "transparent", cursor: "pointer" }}
            >
              Map
            </button>
            <button
              onClick={() => {
                setInvestigationContext({
                  source: "graph",
                  topicId: dominantTopic?.topic_id ?? null,
                  narrativeName: dominantTopic?.name,
                  note: `Drillthrough from graph node ${nodeId}`,
                  createdAt: Date.now(),
                });
                if (dominantTopic?.topic_id !== undefined) setActiveTopic(dominantTopic.topic_id);
                router.push("/stance");
              }}
              className="chip"
              style={{ border: "none", background: "transparent", cursor: "pointer" }}
            >
              Stance
            </button>
          </div>
          <button
            onClick={() => {
              setInvestigationContext({
                source: "graph",
                topicId: dominantTopic?.topic_id ?? null,
                narrativeName: dominantTopic?.name,
                note: `Investigate account ${nodeId} from graph panel`,
                createdAt: Date.now(),
              });
              if (dominantTopic?.topic_id !== undefined) setActiveTopic(dominantTopic.topic_id);
              router.push(`/chat?q=Investigate+account+${encodeURIComponent(nodeId)}`);
            }}
            style={{
              width: "100%",
              padding: "9px",
              background: "rgba(29,158,117,0.1)",
              border: "1px solid #0F3A26",
              borderRadius: 8,
              color: "#1D9E75",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              letterSpacing: ".04em",
              transition: "all .15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(29,158,117,0.2)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(29,158,117,0.1)"; }}
          >
            investigate in Signal →
          </button>
        </div>
      </div>
    </div>
  );
}
