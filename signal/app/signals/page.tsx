// FILE: app/signals/page.tsx
"use client";

/**
 * /signals — Coordinated Behavior detection and visualization.
 *
 * Loads coordination data from /api/coord and renders the CoordHeatmap
 * component — a Canvas-rendered matrix of accounts × time.
 *
 * Detection algorithm (scripts/05_coord.py):
 *   For each pair of accounts, flag as "coordinated" if they share the
 *   same URL AND post within 30 minutes of each other MORE THAN 3 TIMES.
 *
 * This is a conservative, falsifiable definition. The heatmap shows the
 * most synchronized accounts at the top, sorted by total sync events.
 *
 * We show the epistemics clearly in the UI: this is pattern detection,
 * not attribution. False positive explanations are shown inline.
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";

const CoordHeatmap = dynamic(
  () => import("@/components/CoordHeatmap"),
  {
    ssr:     false,
    loading: () => (
      <div
        className="shimmer"
        style={{ flex: 1, minHeight: 0, borderRadius: "var(--radius-md)" }}
      />
    ),
  }
);

interface HeatmapData {
  accounts:  string[];
  months:    string[];
  cells:     { account: string; month: string; count: number }[];
  top_pairs: {
    account_a: string; account_b: string; sync_count: number;
    avg_gap_min: number; shared_urls: string[];
  }[];
}

export default function SignalsPage() {
  const { activeTopic } = useSignalStore();

  const panelRef  = useRef<HTMLDivElement>(null);
  const [dims, setDims]     = useState({ w: 0, h: 0 });
  const [data, setData]     = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coord")
      .then((r) => r.json())
      .then((d) => setData(d as HeatmapData))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  const topPair = data?.top_pairs?.[0];

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Coordinated behavior</span>
        <span className="page-header__meta">
          synchronized posting · same-URL pairs · 30-min window · ≥3 events
        </span>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            {
              label:      "Flagged pairs",
              value:      data ? String(data.top_pairs.length) : "—",
              delta:      "≥3 sync events",
              deltaColor: "var(--coral)",
              mono:       true,
            },
            {
              label: "Unique accounts",
              value: data ? String(data.accounts.length) : "—",
              delta: "in flagged pairs",
              mono:  true,
            },
            {
              label: "Avg sync gap",
              value: topPair ? `${topPair.avg_gap_min.toFixed(0)} min` : "—",
              delta: "top pair",
              mono:  true,
            },
            {
              label: "Timeline span",
              value: `${data?.months.length ?? 0} months`,
              delta: "dataset coverage",
              mono:  true,
            },
          ]}
        />
      </div>

      {/* ── Caveat banner ────────────────────────────────────────────── */}
      <div
        style={{
          margin:       "10px 24px 0",
          padding:      "8px 14px",
          background:   "rgba(212, 160, 23, 0.06)",
          border:       "1px solid rgba(212, 160, 23, 0.2)",
          borderRadius: "var(--radius-md)",
          fontSize:     11,
          color:        "#BA7517",
          fontFamily:   "var(--font-mono)",
          flexShrink:   0,
        }}
      >
        Pattern detection only — correlation ≠ coordination. False positives include cross-posting moderators,
        accounts responding to the same breaking news, and mutual friends sharing viral links simultaneously.
      </div>

      <div
        style={{
          flex:          1,
          minHeight:     0,
          margin:        "10px 24px 0",
          display:       "flex",
          flexDirection: "column",
          gap:           10,
          paddingBottom: 16,
        }}
      >
        {/* ── Main heatmap panel ──────────────────────────────────────── */}
        <div
          ref={panelRef}
          className="viz-panel"
          style={{ flex: 1, minHeight: 300 }}
        >
          <div className="viz-panel__header">
            <span className="viz-panel__title">
              Synchronization heatmap — accounts × time
            </span>
            <span
              style={{
                fontSize:   10,
                color:      "var(--dim)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {loading
                ? "loading…"
                : `${data?.accounts.length ?? 0} accounts · ${data?.months.length ?? 0} months · click row to inspect`}
            </span>
          </div>

          <div className="viz-panel__body" style={{ overflow: "hidden" }}>
            {!loading && dims.w > 0 && dims.h > 0 && (
              <CoordHeatmap
                data={data}
                width={dims.w}
                height={dims.h}
              />
            )}
            {loading && (
              <div
                className="shimmer"
                style={{ height: 400, margin: 8, borderRadius: "var(--radius-sm)" }}
              />
            )}
          </div>
        </div>

        {/* ── Top pairs table ─────────────────────────────────────────── */}
        {!loading && data && data.top_pairs.length > 0 && (
          <div
            className="viz-panel"
            style={{ flexShrink: 0 }}
          >
            <div className="viz-panel__header">
              <span className="viz-panel__title">Top coordinated pairs</span>
              <span
                style={{
                  fontSize:   10,
                  color:      "var(--dim)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                sorted by sync_count desc
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width:          "100%",
                  fontSize:       11,
                  borderCollapse: "collapse",
                  fontFamily:     "var(--font-mono)",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      color:        "var(--dim)",
                      textAlign:    "left",
                    }}
                  >
                    {["account_a", "account_b", "sync count", "avg gap", "shared URLs"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding:       "6px 14px",
                          fontWeight:    400,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.top_pairs.slice(0, 10).map((pair, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #0A0C0E",
                        color:        "var(--text-soft)",
                      }}
                    >
                      <td style={{ padding: "6px 14px", color: "var(--teal)" }}>{pair.account_a}</td>
                      <td style={{ padding: "6px 14px", color: "var(--teal)" }}>{pair.account_b}</td>
                      <td style={{ padding: "6px 14px", color: pair.sync_count >= 10 ? "var(--coral)" : "var(--text-soft)" }}>
                        {pair.sync_count}×
                      </td>
                      <td style={{ padding: "6px 14px" }}>{pair.avg_gap_min.toFixed(1)} min</td>
                      <td style={{ padding: "6px 14px", color: "var(--dim)" }}>
                        {pair.shared_urls.slice(0, 2).map((url) => (
                          <div key={url} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {url}
                          </div>
                        ))}
                        {pair.shared_urls.length > 2 && (
                          <span style={{ color: "var(--muted)" }}>+{pair.shared_urls.length - 2} more</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}