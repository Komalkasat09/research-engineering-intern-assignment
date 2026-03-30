"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MonitorPanel from "@/components/MonitorPanel";

interface AlertItem {
  topic_id?: number;
  severity?: "high" | "medium" | "low";
  score?: number;
  reason?: string;
}

interface WeeklyBrief {
  generated_at?: string;
  highlights?: {
    top_narrative?: string;
    strongest_coord_pair?: string;
    strongest_coord_syncs?: number;
  };
}

function sevColor(sev: AlertItem["severity"]): string {
  if (sev === "high") return "var(--coral)";
  if (sev === "medium") return "var(--amber)";
  return "var(--teal)";
}

export default function AnalystRail({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlerts((d.alerts ?? []) as AlertItem[]))
      .catch(() => setAlerts([]));

    fetch("/api/report/weekly-brief")
      .then((r) => r.json())
      .then((d) => setBrief(d as WeeklyBrief))
      .catch(() => setBrief(null));
  }, [open]);

  if (!open) return null;

  return (
    <aside
      style={{
        borderLeft: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
          Analyst workflow
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>×</button>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 10 }}>
        <MonitorPanel />

        <div className="viz-panel" style={{ borderRadius: 8 }}>
          <div className="viz-panel__header">
            <span className="viz-panel__title">Weekly brief</span>
          </div>
          <div style={{ padding: 10, fontSize: 11, color: "var(--text-soft)", lineHeight: 1.6 }}>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--dim)", marginBottom: 4 }}>
              {brief?.generated_at ? new Date(brief.generated_at).toLocaleString() : "not generated"}
            </div>
            <div>Top narrative: {brief?.highlights?.top_narrative ?? "—"}</div>
            <div>Coord pair: {brief?.highlights?.strongest_coord_pair ?? "—"}</div>
            <div>Syncs: {brief?.highlights?.strongest_coord_syncs ?? 0}</div>
            <Link href="/chat" className="chip active" style={{ display: "inline-flex", marginTop: 8, textDecoration: "none" }}>
              Open briefing workflow
            </Link>
          </div>
        </div>

        <div className="viz-panel" style={{ borderRadius: 8 }}>
          <div className="viz-panel__header">
            <span className="viz-panel__title">Active alerts</span>
          </div>
          <div style={{ padding: 10, display: "grid", gap: 6 }}>
            {alerts.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>No active alerts.</div>
            )}
            {alerts.slice(0, 6).map((a, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", background: "var(--surface-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: sevColor(a.severity), textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-mono)" }}>
                    {a.severity ?? "low"}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "var(--font-mono)" }}>
                    topic #{a.topic_id ?? "?"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 3 }}>{a.reason ?? "signal anomaly"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="viz-panel" style={{ borderRadius: 8 }}>
          <div className="viz-panel__header">
            <span className="viz-panel__title">Quick actions</span>
          </div>
          <div style={{ padding: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Link href="/trends" className="chip" style={{ textDecoration: "none" }}>Trends</Link>
            <Link href="/signals" className="chip" style={{ textDecoration: "none" }}>Coordination</Link>
            <Link href="/origins" className="chip" style={{ textDecoration: "none" }}>Origins</Link>
            <Link href="/benchmark" className="chip" style={{ textDecoration: "none" }}>Benchmark</Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
