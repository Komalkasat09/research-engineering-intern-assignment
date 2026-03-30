"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignalStore } from "@/lib/store";
import { useMonitorAgent } from "@/lib/useMonitorAgent";

function formatLastRun(ts: number, now: number): string {
  if (!ts) return "never";
  const mins = Math.max(0, Math.floor((now - ts) / 60000));
  return `${mins}m ago`;
}

function truncateTitle(title: string, max = 40): string {
  if (title.length <= max) return title;
  return `${title.slice(0, max)}...`;
}

export default function MonitorPanel() {
  useMonitorAgent();
  const router = useRouter();

  const {
    activeTopic,
    savedMonitorQueries,
    addMonitorQuery,
    removeMonitorQuery,
    monitorActive,
    setMonitorActive,
    monitorIntervalMinutes,
    setMonitorIntervalMinutes,
    monitorAlerts,
    dismissMonitorAlert,
    clearMonitorAlerts,
    monitorLastRun,
  } = useSignalStore();

  const [inputValue, setInputValue] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);

  const visibleAlerts = useMemo(
    () => monitorAlerts.filter((a) => !a.dismissed),
    [monitorAlerts],
  );

  function submitQuery() {
    const q = inputValue.trim();
    if (!q) return;
    addMonitorQuery(q, activeTopic);
    setInputValue("");
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="viz-panel" style={{ borderRadius: 8 }}>
        <div className="viz-panel__header">
          <span className="viz-panel__title" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
            Monitor agent
          </span>
        </div>
        <div style={{ padding: 10, display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => setMonitorActive(!monitorActive)}
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              borderRadius: 999,
              padding: "5px 10px",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              width: "fit-content",
              background: monitorActive ? "rgba(29,158,117,0.15)" : "transparent",
              border: monitorActive ? "1px solid var(--teal)" : "1px solid var(--border)",
              color: monitorActive ? "var(--teal)" : "var(--muted)",
            }}
          >
            MONITOR {monitorActive ? "ON" : "OFF"}
          </button>

          {monitorActive && (
            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                Check every:
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[5, 15, 30].map((n) => {
                  const active = monitorIntervalMinutes === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMonitorIntervalMinutes(n)}
                      className="chip"
                      style={{
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        background: active ? "rgba(29,158,117,0.1)" : "transparent",
                        border: active ? "1px solid var(--teal)" : "1px solid var(--border)",
                        color: active ? "var(--teal)" : "var(--muted)",
                      }}
                    >
                      {n}min
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="viz-panel" style={{ borderRadius: 8 }}>
        <div className="viz-panel__header">
          <span className="viz-panel__title" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
            Saved queries
          </span>
        </div>

        <div style={{ padding: 10, display: "grid", gap: 8 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitQuery();
            }}
            style={{ display: "grid", gap: 6 }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="keyword or topic to monitor..."
                style={{
                  flex: 1,
                  background: "#0D1014",
                  border: "1px solid #1E2530",
                  borderRadius: 8,
                  padding: "7px 9px",
                  color: "var(--text)",
                  fontSize: 11,
                  fontFamily: "var(--font-sans)",
                }}
              />
              <button
                type="submit"
                className="chip"
                style={{ cursor: "pointer", fontSize: 11, fontFamily: "var(--font-mono)" }}
              >
                Track
              </button>
            </div>
            {activeTopic !== null && (
              <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                will scope to topic #{activeTopic}
              </span>
            )}
          </form>

          <div style={{ display: "grid", gap: 6 }}>
            {savedMonitorQueries.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                no tracked queries yet
              </div>
            )}

            {savedMonitorQueries.map((q) => {
              const lastRun = monitorLastRun[q.id] ?? 0;
              return (
                <div
                  key={q.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    padding: "7px 8px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-sans)", overflowWrap: "anywhere" }}>
                      {q.query}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMonitorQuery(q.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--muted)",
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                      aria-label="Remove monitor query"
                    >
                      ×
                    </button>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    {formatLastRun(lastRun, nowTs)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {visibleAlerts.length > 0 && (
        <div className="viz-panel" style={{ borderRadius: 8 }}>
          <div className="viz-panel__header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="viz-panel__title" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
                DELTA ALERTS
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--teal)",
                  border: "1px solid rgba(29,158,117,0.35)",
                  background: "rgba(29,158,117,0.1)",
                  borderRadius: 999,
                  padding: "1px 7px",
                }}
              >
                {visibleAlerts.length}
              </span>
            </div>
            <button
              type="button"
              onClick={clearMonitorAlerts}
              className="chip"
              style={{ cursor: "pointer", fontSize: 11, fontFamily: "var(--font-mono)" }}
            >
              clear all
            </button>
          </div>

          <div style={{ padding: 10, display: "grid", gap: 8 }}>
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  border: "1px solid rgba(29,158,117,0.25)",
                  background: "rgba(29,158,117,0.05)",
                  borderRadius: 8,
                  padding: "8px 9px",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--teal)", fontFamily: "var(--font-mono)", overflowWrap: "anywhere" }}>
                    {alert.query}
                  </span>
                  <button
                    type="button"
                    onClick={() => dismissMonitorAlert(alert.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                    }}
                    aria-label="Dismiss monitor alert"
                  >
                    ×
                  </button>
                </div>

                <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-sans)" }}>
                  {alert.newPostCount} new posts · top cluster: {alert.topCluster}
                </div>

                <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                  {new Date(alert.detectedAt).toLocaleTimeString()}
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  {alert.posts.slice(0, 3).map((post, idx) => {
                    const safePostId = (post.post_id ?? "").trim();
                    const safeTitle = (post.title ?? "untitled").trim() || "untitled";
                    const rowKey = `${alert.id}-${safePostId || "missing"}-${idx}`;

                    return (
                    <button
                      key={rowKey}
                      type="button"
                      onClick={() => {
                        if (!safePostId) return;
                        router.push(`/posts?highlight=${safePostId}`);
                      }}
                      style={{
                        textAlign: "left",
                        border: "1px solid rgba(29,158,117,0.25)",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.15)",
                        padding: "5px 7px",
                        cursor: "pointer",
                        display: "grid",
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--teal)", fontFamily: "var(--font-mono)" }}>
                        {safePostId || "unknown"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-sans)" }}>
                        {truncateTitle(safeTitle)}
                      </span>
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
