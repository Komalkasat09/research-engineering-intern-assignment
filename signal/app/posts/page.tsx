"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import type { TopicCluster } from "@/types";

interface PostRow {
  post_id: string;
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

export default function PostsPage() {
  const searchParams = useSearchParams();
  const { activeTopic, setActiveTopic } = useSignalStore();

  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [query, setQuery] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [author, setAuthor] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SearchResponse | null>(null);

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
              value: loading ? "…" : String(data?.total ?? 0),
              delta: "after filters",
              mono: true,
            },
            {
              label: "Returned",
              value: loading ? "…" : String(data?.returned ?? 0),
              delta: loading ? "" : `page ${page + 1}`,
              mono: true,
            },
            {
              label: "Top subreddit",
              value: loading
                ? "…"
                : data?.summary?.top_subreddits?.[0]?.[0] ?? "—",
              delta: loading
                ? ""
                : `${data?.summary?.top_subreddits?.[0]?.[1] ?? 0} posts`,
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
        <div style={{ display: "grid", gap: 8 }}>
          {(data?.posts ?? []).map((p) => (
            <div key={p.post_id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface)", padding: "10px 12px", cursor: "pointer" }} onClick={() => setSelected(p)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  [{p.post_id}] u/{p.author} · r/{p.subreddit} · {p.date} · ↑ {p.score}
                </div>
                <div style={{ fontSize: 10, color: "var(--teal)", fontFamily: "var(--font-mono)" }}>
                  match {p.match_score.toFixed(2)}
                </div>
              </div>
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
            </div>
          ))}

          {!loading && (data?.posts?.length ?? 0) === 0 && (
            <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", padding: 6 }}>
              No posts matched your filters.
            </div>
          )}
        </div>

        {!loading && (data?.total ?? 0) > 0 && (
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
        </div>
      )}
    </Shell>
  );
}
