"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import type { InjectedPost, TopicCluster } from "@/types";

interface PostRow {
  post_id: string;
  title?: string;
  text: string;
  author: string;
  subreddit: string;
  topic_id: number;
  date: string;
  score: number;
  match_score: number;
  matched_terms: string[];
  analysis: {
    amplification: "low" | "medium" | "high";
    stance_hint: string;
    why_matched: string;
  };
}

interface SearchResponse {
  total: number;
  returned: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
  total_all_topics?: number;
  posts: PostRow[];
  summary?: {
    top_subreddits?: Array<[string, number]>;
    top_topics?: Array<[number, number]>;
  };
}

type PostSourceMode = "dataset" | "live" | "both";

interface ExplorerPost extends PostRow {
  source: "dataset" | "live";
  liveConfidence?: number;
}

function toIsoDate(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return "unknown";
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function excerptTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.slice(0, 90) || "Untitled post";
}

function interleavePosts(dataset: ExplorerPost[], live: ExplorerPost[]): ExplorerPost[] {
  const out: ExplorerPost[] = [];
  const maxLen = Math.max(dataset.length, live.length);
  for (let i = 0; i < maxLen; i++) {
    if (dataset[i]) out.push(dataset[i]);
    if (live[i]) out.push(live[i]);
  }
  return out;
}

function PostsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTopic, setActiveTopic, liveFeedResults } = useSignalStore();

  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [query, setQuery] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [author, setAuthor] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ExplorerPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [mode, setMode] = useState<PostSourceMode>("dataset");

  const limit = 25;

  useEffect(() => {
    fetch("/api/clusters")
      .then((r) => r.json())
      .then((d) => setClusters((d.topics ?? []) as TopicCluster[]))
      .catch(() => setClusters([]));
  }, []);

  useEffect(() => {
    const qParam = searchParams.get("q");
    const topicParam = searchParams.get("topic_id");
    if (qParam) setQuery(qParam);
    if (topicParam !== null && topicParam !== "") {
      const tid = Number(topicParam);
      if (Number.isFinite(tid)) setActiveTopic(tid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (subreddit.trim()) params.set("subreddit", subreddit.trim());
    if (author.trim()) params.set("author", author.trim());
    if (activeTopic !== null) params.set("topic_id", String(activeTopic));
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));

    const res = await fetch(`/api/posts/search?${params.toString()}`);
    const payload = (await res.json()) as SearchResponse;
    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    setPage(0);
  }, [activeTopic, query, subreddit, author]);

  useEffect(() => {
    runSearch().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic, page]);

  const topicName = useMemo(() => {
    if (activeTopic === null) return "All topics";
    return cleanTopicName(clusters.find((c) => c.id === activeTopic)?.name ?? `Topic #${activeTopic}`);
  }, [activeTopic, clusters]);

  const topicOptions = useMemo(
    () => [...clusters].filter((c) => c.id !== -1).sort((a, b) => b.count - a.count),
    [clusters],
  );

  const hasLiveResults = (liveFeedResults?.length ?? 0) > 0;

  useEffect(() => {
    if (!hasLiveResults && mode !== "dataset") {
      setMode("dataset");
    }
  }, [hasLiveResults, mode]);

  const datasetPosts = useMemo(
    () => (data?.posts ?? []).map((p) => ({ ...p, source: "dataset" as const })),
    [data?.posts],
  );

  const livePosts = useMemo(() => {
    const rows = (liveFeedResults ?? []).map((post: InjectedPost, idx): ExplorerPost => {
      const combinedText = [post.title, post.selftext].filter(Boolean).join("\n\n").trim();
      return {
        post_id: `live_${idx + 1}`,
        title: post.title,
        text: combinedText || post.title,
        author: post.author,
        subreddit: post.subreddit,
        topic_id: post.assignment.cluster_id,
        date: toIsoDate(post.created_utc),
        score: post.score,
        match_score: Number(post.assignment.confidence.toFixed(3)),
        matched_terms: [],
        analysis: {
          amplification: post.score > 100 ? "high" : post.score > 20 ? "medium" : "low",
          stance_hint: post.assignment.cluster_id === -1 ? "emerging narrative" : `topic #${post.assignment.cluster_id}`,
          why_matched: post.assignment.reasoning,
        },
        source: "live",
        liveConfidence: post.assignment.confidence,
      };
    });

    return rows.filter((p) => {
      if (activeTopic !== null && p.topic_id !== activeTopic) return false;
      if (subreddit.trim() && p.subreddit.toLowerCase() !== subreddit.trim().toLowerCase()) return false;
      if (author.trim() && p.author.toLowerCase() !== author.trim().toLowerCase()) return false;
      if (!query.trim()) return true;

      const q = query.trim().toLowerCase();
      const hay = `${p.title ?? ""} ${p.text} ${p.author} ${p.subreddit}`.toLowerCase();
      return hay.includes(q);
    });
  }, [liveFeedResults, activeTopic, subreddit, author, query]);

  const visiblePosts = useMemo(() => {
    if (mode === "dataset") return datasetPosts;
    if (mode === "live") return livePosts;
    return interleavePosts(datasetPosts, livePosts);
  }, [mode, datasetPosts, livePosts]);

  const topSubreddit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of visiblePosts) {
      counts.set(p.subreddit, (counts.get(p.subreddit) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }, [visiblePosts]);

  const totalMatches = mode === "dataset"
    ? data?.total ?? 0
    : mode === "live"
      ? livePosts.length
      : datasetPosts.length + livePosts.length;

  const returnedMatches = visiblePosts.length;

  function toAskSignalPrefill(post: ExplorerPost): string {
    const narrativeLabel = activeTopic !== null ? `topic #${activeTopic}` : "current";
    const title = (post.title ?? excerptTitle(post.text)).replace(/\s+/g, " ").trim();
    return `Analyze this post: ${title} from r/${post.subreddit}. How does it relate to the ${narrativeLabel} narrative?`;
  }

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Posts explorer</span>
        <span className="page-header__meta">keyword search · raw posts · explainable ranking</span>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label: "Topic scope",
              value: topicName,
              delta: activeTopic === null ? "no topic filter" : `topic #${activeTopic}`,
              mono: true,
            },
            {
              label: "Matches",
              value: loading ? "…" : String(totalMatches),
              delta: `${mode} mode`,
              mono: true,
            },
            {
              label: "Returned",
              value: loading ? "…" : String(returnedMatches),
              delta: loading ? "" : mode === "dataset" ? `page ${page + 1}` : "current view",
              mono: true,
            },
            {
              label: "Top subreddit",
              value: loading ? "…" : topSubreddit,
              delta: loading
                ? ""
                : `${returnedMatches} shown`,
              mono: true,
            },
          ]}
        />
      </div>

      <div style={{ margin: "12px 24px 0", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.3fr auto auto", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords (e.g. immigration, tariffs, DOGE)"
            style={{ background: "#0D1014", border: "1px solid #1E2530", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12 }}
          />
          <input
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
            placeholder="subreddit"
            style={{ background: "#0D1014", border: "1px solid #1E2530", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12 }}
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="author"
            style={{ background: "#0D1014", border: "1px solid #1E2530", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12 }}
          />
          <select
            value={activeTopic === null ? "all" : String(activeTopic)}
            onChange={(e) => {
              const value = e.target.value;
              setActiveTopic(value === "all" ? null : Number(value));
            }}
            style={{ background: "#0D1014", border: "1px solid #1E2530", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12 }}
          >
            <option value="all">All topics</option>
            {topicOptions.map((topic) => (
              <option key={topic.id} value={topic.id}>
                #{topic.id} {cleanTopicName(topic.name)} ({topic.count})
              </option>
            ))}
          </select>
          <button
            className="chip"
            style={{ border: "none", cursor: "pointer" }}
            onClick={() => {
              setPage(0);
              runSearch();
            }}
          >
            Search
          </button>
          <button
            className="chip"
            style={{ border: "none", cursor: "pointer" }}
            onClick={() => {
              setQuery("");
              setSubreddit("");
              setAuthor("");
              setActiveTopic(null);
              setPage(0);
              setTimeout(() => runSearch(), 0);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {!loading && activeTopic !== null && (data?.total ?? 0) === 0 && (data?.total_all_topics ?? 0) > 0 && (
        <div style={{ margin: "8px 24px 0", border: "1px solid rgba(186,117,23,0.4)", background: "rgba(186,117,23,0.08)", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-mono)" }}>
            No results in current topic scope, but {data?.total_all_topics ?? 0} matches exist across all topics.
          </span>
          <button className="chip active" style={{ border: "none", cursor: "pointer" }} onClick={() => setActiveTopic(null)}>
            Clear topic scope
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", margin: "12px 24px 16px" }}>
        {hasLiveResults && (
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              source
            </span>
            {([
              { id: "dataset", label: "Dataset" },
              { id: "live", label: "Live" },
              { id: "both", label: "Both" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                className={`chip ${mode === opt.id ? "active" : ""}`}
                style={{ border: "none", cursor: "pointer" }}
                onClick={() => setMode(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {visiblePosts.map((p) => (
            <div key={`${p.source}-${p.post_id}`} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "10px 12px", cursor: "pointer" }} onClick={() => setSelected(p)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  [{p.post_id}] u/{p.author} · r/{p.subreddit} · {p.date} · ↑ {p.score}
                </div>
                <div style={{ fontSize: 10, color: "var(--teal)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
                  {p.source === "live" && mode === "both" && (
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#1D9E75",
                        animation: "pulseLive 1.2s ease-in-out infinite",
                        boxShadow: "0 0 0 1px rgba(29,158,117,0.35)",
                      }}
                    />
                  )}
                  {p.source === "live" ? `confidence ${(p.liveConfidence ?? p.match_score).toFixed(2)}` : `match ${p.match_score.toFixed(2)}`}
                </div>
              </div>
              {p.title && (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--strong)", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>
                  {p.title}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-soft)", lineHeight: 1.65, fontFamily: "var(--font-serif)" }}>
                {p.text}
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.matched_terms.map((t) => (
                  <span key={t} style={{ fontSize: 10, color: "var(--teal)", border: "1px solid rgba(29,158,117,0.35)", background: "rgba(29,158,117,0.1)", borderRadius: 12, padding: "2px 8px", fontFamily: "var(--font-mono)" }}>
                    {t}
                  </span>
                ))}
                <span style={{ fontSize: 10, color: "var(--amber)", border: "1px solid rgba(186,117,23,0.35)", background: "rgba(186,117,23,0.1)", borderRadius: 12, padding: "2px 8px", fontFamily: "var(--font-mono)" }}>
                  amplification: {p.analysis.amplification}
                </span>
                <span style={{ fontSize: 10, color: "var(--dim)", border: "1px solid var(--border)", borderRadius: 12, padding: "2px 8px", fontFamily: "var(--font-mono)" }}>
                  {p.analysis.stance_hint}
                </span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {p.analysis.why_matched}
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="chip"
                  style={{ border: "none", cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const prompt = toAskSignalPrefill(p);
                    router.push(`/chat?q=${encodeURIComponent(prompt)}`);
                  }}
                >
                  Send to Ask Signal
                </button>
              </div>
            </div>
          ))}

          {!loading && visiblePosts.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", padding: 6 }}>
              No posts matched your filters.
            </div>
          )}
        </div>

        {!loading && mode === "dataset" && (data?.total ?? 0) > 0 && (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              showing {page * limit + 1}-{page * limit + (data?.returned ?? 0)} of {data?.total ?? 0}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="chip" style={{ border: "none", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
              <button className="chip" style={{ border: "none", cursor: data?.has_more ? "pointer" : "not-allowed", opacity: data?.has_more ? 1 : 0.4 }} disabled={!data?.has_more} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ margin: "0 24px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
              Selected post [{selected.post_id}] · topic #{selected.topic_id}
            </div>
            <button className="chip" style={{ border: "none", cursor: "pointer" }} onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-soft)", lineHeight: 1.7, fontFamily: "var(--font-serif)" }}>
            {selected.text}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
            {selected.analysis.why_matched}
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button
              className="chip"
              style={{ border: "none", cursor: "pointer" }}
              onClick={() => {
                const prompt = toAskSignalPrefill(selected);
                router.push(`/chat?q=${encodeURIComponent(prompt)}`);
              }}
            >
              Send to Ask Signal
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseLive {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </Shell>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={null}>
      <PostsPageContent />
    </Suspense>
  );
}
