"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSignalStore } from "@/lib/store";

type ClusterInfo = { id: number; color: string; name?: string; label?: string };

type UmapPoint = {
  umap_x: number;
  umap_y: number;
  topic_id: number;
  post_id: string;
  score: number;
};

type PlotlyLike = {
  newPlot: (el: HTMLDivElement, data: unknown[], layout: unknown, config?: unknown) => Promise<unknown>;
  restyle: (el: HTMLDivElement, update: unknown, traces?: number[] | number) => Promise<unknown>;
  purge: (el: HTMLDivElement) => void;
};

interface Props {
  clusters: ClusterInfo[];
}

const FALLBACK_COLORS = [
  "#1D9E75",
  "#7F77DD",
  "#BA7517",
  "#D85A30",
  "#378ADD",
  "#D4537E",
  "#639922",
  "#E24B4A",
  "#5DCAA5",
  "#888780",
];

export default function UmapScatter({ clusters }: Props) {
  const { activeTopic, setActiveTopic } = useSignalStore();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyLike | null>(null);
  const traceClusterIdsRef = useRef<number[]>([]);
  const [points, setPoints] = useState<UmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [plotReady, setPlotReady] = useState(false);

  const colorByCluster = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of clusters) map.set(c.id, c.color);
    return map;
  }, [clusters]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/umap")
      .then(async (r) => {
        if (!r.ok) throw new Error(`umap: ${r.status}`);
        return (await r.json()) as UmapPoint[];
      })
      .then((data) => {
        if (!mounted) return;
        if (!Array.isArray(data) || data.length === 0) {
          setFailed(true);
          return;
        }
        setPoints(data);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    import("plotly.js-dist-min")
      .then((mod) => {
        if (!mounted) return;
        plotlyRef.current = (mod.default ?? mod) as unknown as PlotlyLike;
        setPlotReady(true);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const el = plotRef.current;
    const Plotly = plotlyRef.current;
    if (!el || !Plotly || loading || failed || points.length === 0) return;

    const clusterLabelMap = new Map(
      clusters.map((c) => [c.id, c.name ?? c.label ?? `topic #${c.id}`])
    );
    const filteredData = points.filter((p) => p.topic_id !== -1);
    if (!filteredData.length) return;

    const grouped = new Map<number, UmapPoint[]>();
    for (const p of filteredData) {
      if (!grouped.has(p.topic_id)) grouped.set(p.topic_id, []);
      grouped.get(p.topic_id)!.push(p);
    }

    const clusterIds = Array.from(grouped.keys()).sort((a, b) => a - b);
    traceClusterIdsRef.current = clusterIds;

    const traces = clusterIds.map((clusterId, idx) => {
      const rows = grouped.get(clusterId) ?? [];
      const color = colorByCluster.get(clusterId) ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
      const opacity = activeTopic === null ? 0.7 : clusterId === activeTopic ? 1.0 : 0.12;

      return {
        type: "scattergl",
        mode: "markers",
        name: clusterLabelMap.get(clusterId) ?? `topic #${clusterId}`,
        x: rows.map((r) => r.umap_x),
        y: rows.map((r) => r.umap_y),
        customdata: rows.map((r) => [
          clusterLabelMap.get(r.topic_id) ?? `topic #${r.topic_id}`,
          Number(r.score ?? 0),
          r.post_id,
        ]),
        marker: {
          size: 4,
          color,
          opacity,
        },
        hovertemplate: "%{customdata[0]}<br>score: %{customdata[1]}<br>id: %{customdata[2]}<extra></extra>",
      };
    });

    const layout = {
      height: 280,
      paper_bgcolor: "#0A0C0E",
      plot_bgcolor: "#0A0C0E",
      margin: { t: 24, b: 16, l: 16, r: 16 },
      font: { color: "#8A9BB0" },
      xaxis: {
        title: "",
        showgrid: false,
        zeroline: false,
        color: "#8A9BB0",
      },
      yaxis: {
        title: "",
        showgrid: false,
        zeroline: false,
        color: "#8A9BB0",
      },
      legend: {
        orientation: "h",
        y: -0.15,
        x: 0,
      },
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      scrollZoom: false,
    };

    void Plotly.newPlot(el, traces, layout, config);

    const onClick = (evt: Event) => {
      const e = evt as Event & {
        detail?: {
          points?: Array<{ curveNumber?: number }>;
        };
      };
      const point = e.detail?.points?.[0];
      const cid = Number.isFinite(point?.curveNumber)
        ? traceClusterIdsRef.current[point!.curveNumber as number]
        : NaN;
      if (Number.isFinite(cid)) setActiveTopic(cid);
    };

    el.addEventListener("plotly_click", onClick as EventListener);

    return () => {
      el.removeEventListener("plotly_click", onClick as EventListener);
      Plotly.purge(el);
    };
  }, [activeTopic, clusters, colorByCluster, failed, loading, plotReady, points, setActiveTopic]);

  useEffect(() => {
    const el = plotRef.current;
    const Plotly = plotlyRef.current;
    const traceClusterIds = traceClusterIdsRef.current;
    if (!el || !Plotly || !traceClusterIds.length) return;

    const opacities = traceClusterIds.map((clusterId) =>
      activeTopic === null ? 0.7 : clusterId === activeTopic ? 1.0 : 0.12
    );

    void Plotly.restyle(el, { "marker.opacity": opacities }, traceClusterIds.map((_, i) => i));
  }, [activeTopic]);

  if (loading) {
    return <div className="shimmer" style={{ height: 280, borderRadius: 8 }} />;
  }

  if (failed || points.length === 0) {
    return (
      <div
        style={{
          height: 280,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          color: "var(--muted)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Embedding visualization unavailable
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        Embedding space · topic clusters · click point to scope
      </div>
      <div ref={plotRef} style={{ height: 280, background: "#0A0C0E", borderRadius: 8 }} />
    </div>
  );
}
