"use client";

/**
 * SpreadGraph.tsx — Force-directed account co-posting network.
 *
 * Uses react-force-graph-2d (D3 force simulation under the hood, Canvas renderer).
 * Handles 2000+ nodes smoothly. WebGL version (3d) would handle 10k+.
 *
 * Visual encoding:
 *   Node size     = PageRank score (influence in the network)
 *   Node color    = topic cluster the account most posts in
 *   Edge opacity  = co-posting weight (how many shared posts)
 *   Node label    = shown on hover only (avoids label clutter at scale)
 *
 * Interactions:
 *   Click node    → setSelectedNode in Zustand, show info panel
 *   Hover node    → tooltip with post count + PageRank
 *   Click canvas  → deselect
 *   Scroll        → zoom (built into react-force-graph-2d)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useSignalStore } from "@/lib/store";
import type { GraphNode, GraphLink } from "@/types";
import NodeDetailPanel from "@/components/NodeDetailPanel";

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((m) => m.default),
  { ssr: false }
);

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface NodeTooltip {
  visible:    boolean;
  x:          number;
  y:          number;
  node:       GraphNode | null;
}

interface NodeConnection {
  id: string;
  label: string;
  weight: number;
  color: string;
}

function linkEndpointId(endpoint: unknown): string | null {
  if (typeof endpoint === "string") return endpoint;
  if (endpoint && typeof endpoint === "object" && "id" in endpoint) {
    const value = (endpoint as { id?: unknown }).id;
    return typeof value === "string" ? value : null;
  }
  return null;
}

const TOPIC_COLORS: Record<number, string> = {
  0:  "#1D9E75", 1: "#7F77DD", 2: "#BA7517", 3: "#D85A30",
  4:  "#888780", 5: "#D4537E", 6: "#378ADD", 7: "#639922",
  8:  "#E24B4A", 9: "#5DCAA5", [-1]: "#3A4148",
};

function nodeColor(n: GraphNode): string {
  const COLORS: Record<number, string> = {
    0: "#1D9E75", 1: "#7F77DD", 2: "#BA7517", 3: "#D85A30",
    4: "#888780", 5: "#D4537E", 6: "#378ADD", 7: "#639922",
    8: "#E24B4A", 9: "#5DCAA5",
  };
  if (n.topic_id !== undefined && n.topic_id !== null && n.topic_id >= 0) {
    return COLORS[n.topic_id] ?? "#5A8A9F";
  }
  if (n.type === "subreddit") return "#378ADD";
  return "#5A6A7A";
}

function nodeSize(n: GraphNode): number {
  // Map PageRank 0–0.05 → radius 3–14
  const r = 3 + Math.sqrt(n.weight * 1000) * 2;
  return Math.min(14, Math.max(3, r));
}

interface Props { width: number; height: number; }

export default function SpreadGraph({ width, height }: Props) {
  const { activeTopic, selectedNode, setSelectedNode } = useSignalStore();
  const [graphData,  setGraphData]  = useState<GraphData>({ nodes: [], links: [] });
  const [connectionMap, setConnectionMap] = useState<Map<string, NodeConnection[]>>(new Map());
  const [loading,    setLoading]    = useState(true);
  const [tooltip,    setTooltip]    = useState<NodeTooltip>({ visible: false, x: 0, y: 0, node: null });
  const graphRef = useRef<any>(null);

  // ── Load graph data ────────────────────────────────────────────────────────
  useEffect(() => {
    const param = activeTopic !== null ? `?topic_id=${activeTopic}&limit=600` : "?limit=600";
    fetch(`/api/graph${param}`)
      .then((r) => r.json())
      .then((data) => {
        setGraphData(data);
        const connMap = new Map<string, NodeConnection[]>();
        const nodes = (data.nodes ?? []) as GraphNode[];
        const nodeById = new Map(nodes.map((n) => [n.id, n]));
        for (const link of (data.links ?? []) as Array<GraphLink & { source?: unknown; target?: unknown }>) {
          const src = linkEndpointId(link.source);
          const tgt = linkEndpointId(link.target);
          if (!src || !tgt) continue;
          const srcNode = nodeById.get(src);
          const tgtNode = nodeById.get(tgt);

          if (!connMap.has(src)) connMap.set(src, []);
          if (!connMap.has(tgt)) connMap.set(tgt, []);

          if (tgtNode) {
            connMap.get(src)?.push({
              id: tgt,
              label: tgtNode.label ?? tgt,
              weight: link.weight ?? 1,
              color: nodeColor(tgtNode),
            });
          }
          if (srcNode) {
            connMap.get(tgt)?.push({
              id: src,
              label: srcNode.label ?? src,
              weight: link.weight ?? 1,
              color: nodeColor(srcNode),
            });
          }
        }
        setConnectionMap(connMap);
        console.log("Graph sample nodes:", (data.nodes ?? []).slice(0, 3));
        setLoading(false);
      })
      .catch(console.error);
  }, [activeTopic]);

  // ── Node paint ─────────────────────────────────────────────────────────────
  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode & { x: number; y: number };
      const r = nodeSize(n);

      // Force topic_id to a number — real data may have strings
      const tid = n.topic_id !== undefined && n.topic_id !== null
        ? parseInt(String(n.topic_id), 10)
        : -1;

      const COLORS: Record<number, string> = {
        0: "#1D9E75", 1: "#7F77DD", 2: "#BA7517", 3: "#D85A30",
        4: "#888780", 5: "#D4537E", 6: "#378ADD", 7: "#639922",
        8: "#E24B4A", 9: "#5DCAA5",
      };

      const baseColor = tid >= 0 ? (COLORS[tid] ?? "#5A8A9F") :
                        (n.type === "subreddit" ? "#378ADD" : "#5A7A8A");

      const isSelected = n.id === selectedNode;
      const isFiltered = activeTopic !== null && tid !== activeTopic;

      // Draw circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = isSelected ? 1 : isFiltered ? 0.20 : 0.85;
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
      }

      // Label for subreddits and high-influence accounts
      if ((n.type === "subreddit" || n.weight > 0.008) && !isFiltered) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#E2E8F0";
        ctx.font = `${Math.max(9, Math.min(r + 2, 13))}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = n.label?.length > 16
          ? n.label.slice(0, 14) + "…"
          : (n.label ?? n.id);
        ctx.fillText(label, n.x, n.y + r + 9);
      }

      ctx.globalAlpha = 1;
    },
    [activeTopic, selectedNode]
  );

  // ── Link paint ─────────────────────────────────────────────────────────────
  const paintLink = useCallback(
    (link: object, ctx: CanvasRenderingContext2D) => {
      const l = link as { source: { x: number; y: number; topic_id: number }; target: { x: number; y: number }; weight: number };
      const opacity = Math.min(0.4, 0.05 + l.weight * 0.02);
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      ctx.strokeStyle = TOPIC_COLORS[l.source.topic_id] ?? "#3A4148";
      ctx.globalAlpha = activeTopic !== null && l.source.topic_id !== activeTopic ? 0.03 : opacity;
      ctx.lineWidth   = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [activeTopic]
  );

  // ── Hover ──────────────────────────────────────────────────────────────────
  const handleNodeHover = useCallback(
    (node: object | null, _prev: object | null, event?: MouseEvent) => {
      if (!node || !event) {
        setTooltip((t) => ({ ...t, visible: false }));
        return;
      }
      setTooltip({
        visible: true,
        x:       event.offsetX + 14,
        y:       event.offsetY - 10,
        node:    node as GraphNode,
      });
    },
    []
  );

  // ── Click ──────────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (node: object) => {
      const n = node as GraphNode;
      setSelectedNode(selectedNode === n.id ? null : n.id);
    },
    [selectedNode, setSelectedNode]
  );

  const selectedNodeData = graphData.nodes.find((n) => n.id === selectedNode) ?? null;

  return (
    <div style={{ position: "relative", width, height }}>
      {loading && (
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            background:     "#0A0C0E",
            fontSize:       12,
            color:          "#4A5568",
            fontFamily:     "var(--font-mono)",
          }}
        >
          building network…
        </div>
      )}

      {!loading && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData as { nodes: object[]; links: object[] }}
          width={width}
          height={height}
          backgroundColor="#0A0C0E"
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          nodeLabel={() => ""}
          onNodeHover={handleNodeHover as (node: object | null, prev: object | null, event?: MouseEvent) => void}
          onNodeClick={handleNodeClick}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1}
          linkDirectionalParticleColor={(link: object) => {
            const l = link as { source: { topic_id: number } };
            return TOPIC_COLORS[l.source.topic_id] ?? "#3A4148";
          }}
          cooldownTicks={80}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      )}

      {/* Hover tooltip */}
      {tooltip.visible && tooltip.node && (
        <div
          style={{
            position:      "absolute",
            left:          tooltip.x,
            top:           tooltip.y,
            background:    "#111418",
            border:        "1px solid #1E2530",
            borderRadius:  8,
            padding:       "8px 12px",
            pointerEvents: "none",
            zIndex:        20,
            minWidth:      160,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0", marginBottom: 4 }}>
            {tooltip.node.label}
          </div>
          <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "var(--font-mono)" }}>
            {tooltip.node.type} · topic #{tooltip.node.topic_id}
          </div>
          <div style={{ fontSize: 11, color: "#8A9BB0", marginTop: 4, fontFamily: "var(--font-mono)" }}>
            pagerank: {tooltip.node.weight.toFixed(5)}
          </div>
          <div style={{ fontSize: 11, color: "#8A9BB0", fontFamily: "var(--font-mono)" }}>
            posts: {tooltip.node.post_count.toLocaleString()}
          </div>
        </div>
      )}

      {selectedNodeData && (
        <NodeDetailPanel
          nodeId={selectedNodeData.id}
          nodeType={selectedNodeData.type}
          nodeCommunity={selectedNodeData.community}
          nodeWeight={selectedNodeData.weight}
          nodePostCount={selectedNodeData.post_count}
          connections={(connectionMap.get(selectedNodeData.id) ?? []).slice(0, 10)}
          onClose={() => setSelectedNode(null)}
        />
      )}

      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(8px); } to { opacity:1; transform:translateX(0); } }`}</style>

      {/* Controls hint */}
      {!loading && (
        <div
          style={{
            position:   "absolute",
            bottom:     12,
            left:       14,
            fontSize:   10,
            color:      "#2A3340",
            fontFamily: "var(--font-mono)",
            pointerEvents: "none",
          }}
        >
          scroll to zoom · drag canvas · click node to inspect
        </div>
      )}
    </div>
  );
}