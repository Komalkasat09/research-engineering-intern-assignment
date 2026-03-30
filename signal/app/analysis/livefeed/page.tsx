"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { injectPosts } from "@/lib/liveInject";
import { TOPIC_COLORS } from "@/lib/constants";
import { useSignalStore } from "@/lib/store";
import type { InjectedPost, TopicCluster } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface FeedState {
  query: string;
  error: string | null;
  posts: InjectedPost[];
  clusters: TopicCluster[];
  timestamp: string | null;
}

interface PersistedLiveFeedState {
  query: string;
  error: string | null;
  posts: InjectedPost[];
  timestamp: string | null;
}

const LIVE_FEED_SESSION_KEY = "signal-live-feed-state-v1";

function isValidInjectedPost(post: unknown): post is InjectedPost {
  if (!post || typeof post !== "object") return false;

  const p = post as Partial<InjectedPost>;
  if (!p.assignment || typeof p.assignment !== "object") return false;

  return (
    typeof p.title === "string"
    && typeof p.subreddit === "string"
    && typeof p.author === "string"
    && typeof p.score === "number"
    && typeof p.assignment.cluster_id === "number"
    && typeof p.assignment.confidence === "number"
    && typeof p.assignment.is_new_narrative === "boolean"
  );
}

function sanitizeInjectedPosts(posts: unknown): InjectedPost[] {
  if (!Array.isArray(posts)) return [];
  return posts.filter(isValidInjectedPost);
}

// ── Loading Skeleton Component (Shimmer Animation) ────────────────────────

function PostSkeleton() {
  return (
    <div
      style={{
        padding: "12px",
        border: `1px solid var(--border)`,
        borderRadius: "6px",
        backgroundColor: "var(--surface)",
        marginBottom: "10px",
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    >
      <div
        style={{
          height: "16px",
          backgroundColor: "var(--border)",
          borderRadius: "4px",
          marginBottom: "8px",
          width: "70%",
        }}
      />
      <div
        style={{
          height: "12px",
          backgroundColor: "var(--border)",
          borderRadius: "4px",
          marginBottom: "8px",
          width: "90%",
        }}
      />
      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <div
          style={{
            height: "24px",
            width: "120px",
            backgroundColor: "var(--border)",
            borderRadius: "4px",
          }}
        />
        <div
          style={{
            height: "24px",
            width: "100px",
            backgroundColor: "var(--border)",
            borderRadius: "4px",
          }}
        />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Helper: Color for cluster ID ───────────────────────────────────────────

function getClusterColor(clusterId: number): string {
  return TOPIC_COLORS[clusterId] || TOPIC_COLORS[-1] || "#3A4148";
}

// ── Get confidence badge color (gradient based on score) ───────────────────

function getConfidenceColor(conf: number): string {
  if (conf >= 0.85) return "#1D9E75"; // High confidence - teal
  if (conf >= 0.70) return "#378ADD"; // Medium - blue
  return "#D4537E"; // Low - pink
}

// ── Post Card with Modern Animations & Interactions ────────────────────────

interface PostCardProps {
  post: InjectedPost;
  clusterNameMap: Record<number, string>;
  index: number;
}

function PostCard({ post, clusterNameMap, index }: PostCardProps) {
  const [expanded, setExpanded] = useState(true);

  const clusterColor = getClusterColor(post.assignment.cluster_id);
  const clusterName =
    clusterNameMap[post.assignment.cluster_id] || post.assignment.cluster;
  const confidencePercent = Math.round(post.assignment.confidence * 100);

  return (
    <div
      style={{
        padding: "12px",
        border: `1px solid var(--border)`,
        borderRadius: "6px",
        backgroundColor: "var(--surface)",
        marginBottom: "10px",
        animation: `slideIn 0.4s ease-out ${index * 0.05}s both`,
        transition: "all 0.2s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--teal)";
        el.style.boxShadow = "0 2px 8px rgba(29, 158, 117, 0.1)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--border)";
        el.style.boxShadow = "none";
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header: title + subreddit + score */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--teal)",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "500",
              display: "block",
              marginBottom: "6px",
              wordBreak: "break-word",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#0fb89b";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = "var(--teal)";
            }}
          >
            {post.title}
          </a>
          <div
            style={{
              fontSize: "12px",
              color: "var(--muted)",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span>r/{post.subreddit}</span>
            <span>·</span>
            <span>↑ {post.score.toLocaleString()}</span>
            <span>·</span>
            <span>by u/{post.author}</span>
          </div>
        </div>
      </div>

      {/* Cluster assignment row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "10px",
          flexWrap: "wrap",
        }}
      >
        {/* Cluster badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            backgroundColor: clusterColor,
            color: "#fff",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "600",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.5)",
            }}
          />
          {clusterName}
        </div>

        {/* Confidence badge (color gradient based on score) */}
        <div
          style={{
            padding: "4px 8px",
            backgroundColor: getConfidenceColor(post.assignment.confidence),
            color: "#fff",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "600",
            transition: "all 0.2s",
          }}
          title={`${confidencePercent}% confidence score`}
        >
          {confidencePercent}% confident
        </div>

        {/* New narrative warning (animated) */}
        {post.assignment.is_new_narrative && (
          <div
            style={{
              padding: "4px 8px",
              backgroundColor: "#D4537E",
              color: "#fff",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: "600",
              animation: "pulse 2s ease-in-out infinite",
            }}
            title="This post may represent an emerging narrative"
          >
            Emerging signal
          </div>
        )}
      </div>

      {/* Reasoning (collapsible with smooth animation) */}
      <div style={{ marginTop: "8px" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "none",
            border: "none",
            color: "var(--teal)",
            cursor: "pointer",
            fontSize: "12px",
            padding: "0",
            textDecoration: expanded ? "underline" : "none",
            transition: "all 0.2s",
          }}
        >
          {expanded ? "Hide reasoning" : "Show reasoning"}
        </button>
        {expanded && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px",
              backgroundColor: "rgba(34, 46, 61, 0.8)",
              borderRadius: "4px",
              fontSize: "12px",
              color: "var(--text)",
              lineHeight: "1.4",
              animation: "slideDown 0.2s ease-out",
              border: "1px solid rgba(95, 116, 141, 0.35)",
            }}
          >
            {post.assignment.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────

export default function LiveFeedPage() {
  const router = useRouter();
  const { setLiveFeedResults } = useSignalStore();
  const [isPending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [state, setState] = useState<FeedState>({
    query: "",
    error: null,
    posts: [],
    clusters: [],
    timestamp: null,
  });

  async function fetchLivePosts(searchQuery: string, clearBeforeFetch = true) {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setState((prev) => ({ ...prev, error: "Enter a search query" }));
      return;
    }

    startTransition(async () => {
      if (clearBeforeFetch) {
        setState((prev) => ({
          ...prev,
          error: null,
          posts: [],
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: null,
        }));
      }

      setLiveFeedResults(null);
      setRetryCount(0);

      const attemptFetch = async (attempt: number): Promise<void> => {
        try {
          const result = await injectPosts(trimmed, 25);
          const safePosts = sanitizeInjectedPosts(result.posts);
          setState((prev) => ({
            ...prev,
            query: trimmed,
            posts: safePosts,
            timestamp: result.timestamp,
            error: null,
          }));
          setLiveFeedResults(safePosts);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to fetch posts";

          // Retry logic with exponential backoff (for rate limits)
          if (attempt < 2 && message.includes("429")) {
            const waitTime = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            setRetryCount(attempt + 1);
            return attemptFetch(attempt + 1);
          }

          setState((prev) => ({
            ...prev,
            error: message,
          }));
          setLiveFeedResults(null);
        }
      };

      await attemptFetch(0);
    });
  }

  // Fetch clusters on mount
  useEffect(() => {
    const fetchClusters = async () => {
      try {
        const res = await fetch("/api/clusters");
        const data = await res.json() as { topics: TopicCluster[] };
        const topics = data.topics ?? [];

        let restored: PersistedLiveFeedState | null = null;
        try {
          const raw = sessionStorage.getItem(LIVE_FEED_SESSION_KEY);
          if (raw) {
            restored = JSON.parse(raw) as PersistedLiveFeedState;
          }
        } catch {
          restored = null;
        }

        const restoredPosts = sanitizeInjectedPosts(restored?.posts);

        setState((prev) => ({
          ...prev,
          clusters: topics,
          query: restored?.query ?? prev.query,
          posts: restoredPosts.length ? restoredPosts : prev.posts,
          timestamp: restored?.timestamp ?? prev.timestamp,
          error: restored?.error ?? prev.error,
        }));

        if (restoredPosts.length) {
          setLiveFeedResults(restoredPosts);
        }

        if (restored?.query?.trim()) {
          // Refresh latest live results in background while keeping restored data visible.
          void fetchLivePosts(restored.query, false);
        }
      } catch (err) {
        console.error("Failed to load clusters:", err);
      }
      setHydrated(true);
    };

    fetchClusters();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const snapshot: PersistedLiveFeedState = {
      query: state.query,
      error: state.error,
      posts: state.posts,
      timestamp: state.timestamp,
    };

    try {
      sessionStorage.setItem(LIVE_FEED_SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore session storage quota/unavailable errors.
    }
  }, [hydrated, state.query, state.error, state.posts, state.timestamp]);

  // Build cluster name map
  const clusterNameMap = state.clusters.reduce(
    (acc, c) => {
      acc[c.id] = c.name;
      return acc;
    },
    {} as Record<number, string>
  );

  // Handle search with exponential backoff retry
  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await fetchLivePosts(state.query, true);
  };

  if (!hydrated) {
    return null;
  }

  const safePosts = sanitizeInjectedPosts(state.posts);

  // Calculate stats
  const newNarratives = safePosts.filter(
    (p) => p.assignment.is_new_narrative
  ).length;
  const existingClusters = new Set(
    safePosts
      .filter((p) => !p.assignment.is_new_narrative)
      .map((p) => p.assignment.cluster_id)
  ).size;

  // Filter to cluster view
  const selectedClusterIds = safePosts
    .filter((p) => !p.assignment.is_new_narrative)
    .map((p) => p.assignment.cluster_id);

  return (
    <Shell>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "16px 18px 20px",
        }}
      >
        <div
          style={{
            width: "100%",
          maxWidth: "900px",
          margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
        }}
      >
          {/* Header with description */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "linear-gradient(180deg, rgba(18,28,42,0.65), rgba(12,18,26,0.7))",
              padding: "14px 14px 12px",
            }}
          >
            <h1 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "6px" }}>
              Live Feed Injector
            </h1>
            <p style={{ color: "var(--muted)", fontSize: "14px", margin: 0 }}>
              Real-time Reddit post classification with AI-powered narrative mapping
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} style={{ position: "sticky", top: 0, zIndex: 5 }}>
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "12px",
                backgroundColor: "rgba(13,18,24,0.92)",
                backdropFilter: "blur(6px)",
                border: `1px solid var(--border)`,
                borderRadius: "10px",
                transition: "all 0.2s",
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              <input
                type="text"
                placeholder="Search Reddit: ukraine, climate change, tariffs..."
                value={state.query}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, query: e.target.value }))
                }
                style={{
                  flex: 1,
                  padding: "9px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor =
                    "var(--teal)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor =
                    "var(--border)";
                }}
              />
              <button
                type="submit"
                disabled={isPending}
                style={{
                  padding: "8px 16px",
                  backgroundColor: isPending ? "var(--muted)" : "var(--teal)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: isPending ? "default" : "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "Classifying..." : "Search"}
              </button>
            </div>
          </form>

        {/* Error message with retry button */}
        {state.error && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "#D85A30",
              color: "#fff",
              borderRadius: "6px",
              fontSize: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{state.error}</span>
            {retryCount < 2 && (
              <button
                onClick={() =>
                  handleSearch({
                    preventDefault: () => {},
                  } as React.FormEvent<HTMLFormElement>)
                }
                style={{
                  padding: "4px 8px",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(255,255,255,0.2)";
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Loading state with skeleton loaders */}
        {isPending && safePosts.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <p style={{ marginBottom: "16px", color: "var(--muted)" }}>
              Fetching and classifying posts...
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                marginBottom: "16px",
              }}
            >
              Using Llama 3.3 70B via Groq API (inference optimized)
            </p>
            {[1, 2, 3].map((i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Summary stats bar */}
        {safePosts.length > 0 && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "var(--border)",
              borderRadius: "6px",
              fontSize: "13px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span>
              <strong>{safePosts.length} posts</strong> classified into{" "}
              <strong>{existingClusters} clusters</strong>
              {newNarratives > 0 && (
                <>
                  {" "}· <strong>{newNarratives}</strong> emerging
                </>
              )}
            </span>
            {selectedClusterIds.length > 0 && (
              <button
                onClick={() => {
                  const clusterParam = [...new Set(selectedClusterIds)].join(",");
                  router.push(`/explore?highlight=${clusterParam}`);
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "var(--teal)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.backgroundColor = "#0fb89b";
                  el.style.boxShadow = "0 2px 8px rgba(29, 158, 117, 0.3)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.backgroundColor = "var(--teal)";
                  el.style.boxShadow = "none";
                }}
              >
                View on map
              </button>
            )}
          </div>
        )}

        {/* Results feed */}
        {safePosts.length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: "10px", background: "rgba(10,14,20,0.5)", padding: "10px" }}>
            <div
              style={{
                marginBottom: "12px",
                fontSize: "12px",
                color: "var(--muted)",
                paddingLeft: "2px",
              }}
            >
              Last updated:{" "}
              <span style={{ color: "var(--teal)" }}>
                {new Date(state.timestamp || Date.now()).toLocaleTimeString()}
              </span>
            </div>
            <div>
              {safePosts.map((post, i) => (
                <PostCard
                  key={i}
                  post={post}
                  clusterNameMap={clusterNameMap}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state - no results found */}
        {!isPending && safePosts.length === 0 && state.query && (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>
              No posts found for "{state.query}"
            </p>
            <p style={{ fontSize: "12px" }}>
              Try broader keywords or search recent trending topics
            </p>
          </div>
        )}

        {/* Guidance - shown on first load */}
        {!isPending && safePosts.length === 0 && !state.query && (
          <div
            style={{
              padding: "20px",
              backgroundColor: "rgba(29, 40, 56, 0.72)",
              borderRadius: "6px",
              color: "var(--text)",
              fontSize: "14px",
              lineHeight: "1.6",
              border: "1px solid rgba(71, 95, 122, 0.45)",
            }}
          >
            <p style={{ marginBottom: "12px", fontWeight: "600", color: "var(--strong)" }}>
              Workflow overview:
            </p>
            <ul
              style={{
                marginLeft: "20px",
                marginBottom: "0",
                listStyle: "none",
                paddingLeft: "0",
              }}
            >
              <li style={{ marginBottom: "6px" }}>
                Search Reddit for recent topics (last 7 days)
              </li>
              <li style={{ marginBottom: "6px" }}>
                Classify posts using Llama 3.3 70B
              </li>
              <li style={{ marginBottom: "6px" }}>
                Review confidence scores with severity color coding
              </li>
              <li>Map results to existing narrative clusters</li>
            </ul>
          </div>
        )}

        {/* Global animations */}
          <style>{`
          @keyframes slideDown {
            from {
              opacity: 0;
              max-height: 0;
              overflow: hidden;
            }
            to {
              opacity: 1;
              max-height: 500px;
            }
          }
          `}</style>
        </div>
      </div>
    </Shell>
  );
}
