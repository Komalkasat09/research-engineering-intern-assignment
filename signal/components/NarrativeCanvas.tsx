"use client";

/**
 * NarrativeCanvas.tsx — WebGL scatter plot of all posts in UMAP 2D space.
 *
 * Rendering approach: PIXI.ParticleContainer + single circular texture.
 * One draw call renders the entire cloud regardless of point count.
 * At 800k points this runs at 60fps; a Graphics loop would crash at 5k.
 *
 * Interaction model:
 *   - Drag to pan (pointer events on the canvas)
 *   - Wheel to zoom (scale transform on the container)
 *   - Click a cluster centroid label → setActiveTopic in Zustand
 *   - Hover a point → show tooltip (throttled, checks nearest point in O(n))
 *
 * The canvas is a "dumb" renderer. All state lives in Zustand.
 * When activeTopic changes, the canvas dims non-matching points via alpha.
 */

import {
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import * as PIXI from "pixi.js";
import { useSignalStore } from "@/lib/store";
import { cleanTopicName } from "@/lib/cleanTopicName";
import { fetchMapData, type MapPoint, type MapData } from "@/lib/mapData";
import type { TopicCluster } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const POINT_RADIUS   = 3;     // base radius in canvas pixels
const POINT_ALPHA    = 0.75;  // default alpha
const DIM_ALPHA      = 0.08;  // alpha for non-active-topic points
const ACTIVE_ALPHA   = 0.90;  // alpha for active-topic points
const HOVER_RADIUS   = 12;    // px — how close cursor must be to register hover
const MIN_ZOOM       = 0.4;
const MAX_ZOOM       = 12;
const ZOOM_SPEED     = 0.001;

// ── Tooltip state ─────────────────────────────────────────────────────────────

interface TooltipState {
  visible:   boolean;
  x:         number;
  y:         number;
  postId:    string;
  topicName: string;
  score:     number;
}

// ── Circular texture factory ──────────────────────────────────────────────────
// Creates one reusable texture per topic color via PIXI.Graphics → texture.
// ParticleContainer requires all sprites to share the same base texture,
// so we tint the sprites at runtime instead of making per-color textures.

function makeCircleTexture(app: PIXI.Application, radius: number): PIXI.Texture {
  try {
    if (!app.renderer || typeof app.renderer.generateTexture !== "function") {
      return PIXI.Texture.WHITE;
    }
    const g = new PIXI.Graphics();
    g.circle(radius, radius, radius).fill(0xffffff);
    return app.renderer.generateTexture(g);
  } catch {
    return PIXI.Texture.WHITE;
  }
}

// ── Hex color → PIXI tint integer ────────────────────────────────────────────
function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

// ── Topic color lookup ────────────────────────────────────────────────────────
const TOPIC_COLORS: Record<number, string> = {
  0:  "#1D9E75",
  1:  "#7F77DD",
  2:  "#BA7517",
  3:  "#D85A30",
  4:  "#888780",
  5:  "#D4537E",
  6:  "#378ADD",
  7:  "#639922",
  8:  "#E24B4A",
  9:  "#5DCAA5",
  [-1]: "#3A4148",
};

function topicColor(id: number): string {
  return TOPIC_COLORS[id] ?? "#3A4148";
}

// ── Main component ────────────────────────────────────────────────────────────

interface NarrativeCanvasProps {
  width:  number;
  height: number;
}

export default function NarrativeCanvas({ width, height }: NarrativeCanvasProps) {
  const canvasRef     = useRef<HTMLDivElement>(null);
  const appRef        = useRef<PIXI.Application | null>(null);
  const containerRef  = useRef<PIXI.ParticleContainer | null>(null);
  const labelsRef     = useRef<PIXI.Container | null>(null);
  const spritesRef    = useRef<PIXI.Sprite[]>([]);
  const pointsRef     = useRef<MapPoint[]>([]);
  const clustersRef   = useRef<TopicCluster[]>([]);
  const isDragging    = useRef(false);
  const lastPanPos    = useRef({ x: 0, y: 0 });
  const zoomRef       = useRef(1);
  const panRef        = useRef({ x: 0, y: 0 });

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tooltip, setTooltip]   = useState<TooltipState>({
    visible: false, x: 0, y: 0, postId: "", topicName: "", score: 0,
  });

  const { activeTopic, setActiveTopic, setMeta } = useSignalStore();
  const activeTopicRef = useRef(activeTopic);
  activeTopicRef.current = activeTopic;

  // ── Apply alpha based on active topic ──────────────────────────────────────
  const applyAlpha = useCallback((active: number | null) => {
    const sprites = spritesRef.current;
    const points  = pointsRef.current;
    for (let i = 0; i < sprites.length; i++) {
      if (active === null) {
        sprites[i].alpha = POINT_ALPHA;
      } else {
        sprites[i].alpha =
          points[i].topicId === active ? ACTIVE_ALPHA : DIM_ALPHA;
      }
    }
  }, []);

  // ── Hit test: find nearest point to canvas coords ─────────────────────────
  // O(n) — fast enough for hover at 60fps since we throttle to 60ms
  const findNearestPoint = useCallback(
    (canvasX: number, canvasY: number): number | null => {
      const points = pointsRef.current;
      const zoom   = zoomRef.current;
      const pan    = panRef.current;

      // Convert canvas coords → world coords
      const worldX = (canvasX - pan.x) / zoom;
      const worldY = (canvasY - pan.y) / zoom;

      let minDist = (HOVER_RADIUS / zoom) ** 2;
      let nearest = -1;

      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - worldX;
        const dy = points[i].y - worldY;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist) { minDist = d2; nearest = i; }
      }

      return nearest === -1 ? null : nearest;
    },
    [],
  );

  // ── Click handler — select cluster by centroid proximity ─────────────────
  const handleCanvasClick = useCallback(
    (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect  = canvasRef.current.getBoundingClientRect();
      const cx    = e.clientX - rect.left;
      const cy    = e.clientY - rect.top;
      const idx   = findNearestPoint(cx, cy);

      if (idx === null) {
        setActiveTopic(null);
        return;
      }

      const point   = pointsRef.current[idx];
      const topic   = point.topicId;
      const current = activeTopicRef.current;

      // Toggle: clicking the same topic again clears the filter
      setActiveTopic(current === topic ? null : topic);
    },
    [findNearestPoint, setActiveTopic],
  );

  // ── Hover handler (throttled to 60ms) ─────────────────────────────────────
  const hoverTimer = useRef<number>(0);
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const now = Date.now();
      if (now - hoverTimer.current < 60) return;
      hoverTimer.current = now;

      if (!canvasRef.current || isDragging.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx   = e.clientX - rect.left;
      const cy   = e.clientY - rect.top;
      const idx  = findNearestPoint(cx, cy);

      if (idx === null) {
        setTooltip((t) => ({ ...t, visible: false }));
        return;
      }

      const p       = pointsRef.current[idx];
      const cluster = clustersRef.current.find((c) => c.id === p.topicId);

      setTooltip({
        visible:   true,
        x:         cx + 12,
        y:         cy - 8,
        postId:    p.postId,
        topicName: cluster?.name ? cleanTopicName(cluster.name) : `topic ${p.topicId}`,
        score:     p.score,
      });
    },
    [findNearestPoint],
  );

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: PointerEvent) => {
    isDragging.current  = true;
    lastPanPos.current  = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || !appRef.current) return;
    const dx  = e.clientX - lastPanPos.current.x;
    const dy  = e.clientY - lastPanPos.current.y;
    lastPanPos.current = { x: e.clientX, y: e.clientY };

    panRef.current.x += dx;
    panRef.current.y += dy;

    const world = appRef.current.stage.children[0] as PIXI.Container;
    if (world) { world.x = panRef.current.x; world.y = panRef.current.y; }
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Zoom handler ──────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!appRef.current || !canvasRef.current) return;

    const rect   = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta  = -e.deltaY * ZOOM_SPEED;
    const factor = Math.exp(delta);
    const newZ   = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * factor));
    const ratio  = newZ / zoomRef.current;
    zoomRef.current = newZ;

    // Zoom towards mouse cursor (not centre)
    panRef.current.x = mouseX + (panRef.current.x - mouseX) * ratio;
    panRef.current.y = mouseY + (panRef.current.y - mouseY) * ratio;

    const world = appRef.current.stage.children[0] as PIXI.Container;
    if (world) {
      world.scale.set(newZ);
      world.x = panRef.current.x;
      world.y = panRef.current.y;
    }
  }, []);

  // ── Build centroid label overlay ──────────────────────────────────────────
  const buildLabels = useCallback(
    (clusters: TopicCluster[], data: MapData) => {
      if (!appRef.current) return;
      const labelContainer = new PIXI.Container();
      appRef.current.stage.children[0]?.addChild(labelContainer);
      labelsRef.current = labelContainer;

      for (const cluster of clusters) {
        if (cluster.id === -1) continue;

        // Find approximate centroid in pixel space from the data
        const clusterPoints = data.points.filter((p: MapPoint) => p.topicId === cluster.id);
        if (clusterPoints.length === 0) continue;

        const cx = clusterPoints.reduce((s: number, p: MapPoint) => s + p.x, 0) / clusterPoints.length;
        const cy = clusterPoints.reduce((s: number, p: MapPoint) => s + p.y, 0) / clusterPoints.length;

        // Background pill
        const pill = new PIXI.Graphics();
        const color = parseInt(topicColor(cluster.id).replace("#", ""), 16);

        // Label text
        const label = new PIXI.Text({ text: cleanTopicName(cluster.name), style: {
          fontFamily: "ui-monospace, monospace",
          fontSize:   11,
          fill:       0xffffff,
          fontWeight: "500",
        }});
        label.resolution = window.devicePixelRatio || 1;

        const padX = 8, padY = 4;
        const lw   = label.width + padX * 2;
        const lh   = label.height + padY * 2;

        pill.roundRect(0, 0, lw, lh, lh / 2).fill({ color, alpha: 0.85 });

        label.x = padX;
        label.y = padY;
        pill.addChild(label);

        pill.x = cx - lw / 2;
        pill.y = cy - lh / 2;
        pill.interactive = true;
        pill.cursor      = "pointer";

        // Click label → set topic filter
        pill.on("pointerdown", (ev: PIXI.FederatedPointerEvent) => {
          ev.stopPropagation();
          const current = activeTopicRef.current;
          setActiveTopic(current === cluster.id ? null : cluster.id);
        });

        // Hover: scale up slightly
        pill.on("pointerover", () => { pill.scale.set(1.1); });
        pill.on("pointerout",  () => { pill.scale.set(1.0); });

        labelContainer.addChild(pill);
      }
    },
    [setActiveTopic],
  );

  // ── Initialise Pixi + load data ───────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy any previous instance (React StrictMode double-mount)
    if (appRef.current) {
      appRef.current.destroy({
        removeView: true,
      }, {
        children: true,
      });
      appRef.current = null;
    }

    let isDisposed = false;
    let isInitialized = false;

    const app = new PIXI.Application();

    // Pixi v8 uses async init
    (async () => {
      await app.init({
        width,
        height,
        background:  0x0A0C0E,
        antialias:   false,
        resolution:  window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (isDisposed) {
        app.destroy({ removeView: true }, { children: true });
        return;
      }

      isInitialized = true;

      if (!canvasRef.current) return;
      canvasRef.current.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;

      // World container — pan/zoom transforms go here
      const world = new PIXI.Container();
      app.stage.addChild(world);

      try {
        const data = await fetchMapData(width, height);
        if (isDisposed || !app.renderer) return;

        setMeta(data.meta);
        clustersRef.current = data.clusters;
        pointsRef.current   = data.points;

        // One texture for all sprites (white circle, tinted per-sprite)
        const tex = makeCircleTexture(app, POINT_RADIUS);

        // ParticleContainer: single draw call for the whole cloud.
        const pc = new PIXI.ParticleContainer({
          dynamicProperties: { tint: true, alpha: true, position: true },
        });
        world.addChild(pc);
        containerRef.current = pc;

        const sprites: PIXI.Sprite[] = [];

        for (const point of data.points) {
          if (isDisposed) break;
          const sprite  = new PIXI.Sprite(tex);
          sprite.tint   = hexToInt(topicColor(point.topicId));
          sprite.alpha  = POINT_ALPHA;
          sprite.x      = point.x - POINT_RADIUS;
          sprite.y      = point.y - POINT_RADIUS;
          const sz = 1 + Math.sqrt(Math.min(point.score, 5000)) * 0.004;
          if (tex === PIXI.Texture.WHITE) {
            const size = Math.max(2, POINT_RADIUS * 2 * sz);
            sprite.width = size;
            sprite.height = size;
          } else {
            sprite.scale.set(sz);
          }
          const particleContainer = pc as unknown as {
            addParticle?: (child: PIXI.Sprite) => void;
            addChild?: (child: PIXI.Sprite) => void;
          };

          if (typeof particleContainer.addParticle === "function") {
            particleContainer.addParticle(sprite);
          } else {
            particleContainer.addChild?.(sprite);
          }
          sprites.push(sprite);
        }

        spritesRef.current = sprites;
        applyAlpha(activeTopicRef.current);
        if (!isDisposed) buildLabels(data.clusters, data);
        setLoading(false);
      } catch (err) {
        console.error("[NarrativeCanvas]", err);
        setError(err instanceof Error ? err.message : "Failed to load map data");
        setLoading(false);
      }
    })();

    // Attach event listeners
    const el = canvasRef.current;
    el.addEventListener("click",       handleCanvasClick);
    el.addEventListener("mousemove",   handleMouseMove);
    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup",   handlePointerUp);
    el.addEventListener("wheel",       handleWheel, { passive: false });

    return () => {
      isDisposed = true;
      el.removeEventListener("click",       handleCanvasClick);
      el.removeEventListener("mousemove",   handleMouseMove);
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup",   handlePointerUp);
      el.removeEventListener("wheel",       handleWheel);

      // React StrictMode may unmount before async Pixi init finishes.
      // Destroy only once init has completed to avoid internal resize hook errors.
      if (isInitialized) {
        app.destroy({
          removeView: true,
        }, {
          children: true,
        });
      }

      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // ── React to activeTopic changes (dim/highlight) ──────────────────────────
  useEffect(() => {
    applyAlpha(activeTopic);
  }, [activeTopic, applyAlpha]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width, height, cursor: "crosshair" }}>
      {/* Pixi canvas mounts here */}
      <div ref={canvasRef} style={{ width, height }} />

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            background:     "#0A0C0E",
            gap:            12,
          }}
        >
          <CanvasLoadingIndicator />
          <span
            style={{
              fontSize:    12,
              color:       "#4A5568",
              fontFamily:  "var(--font-mono)",
              letterSpacing: "0.05em",
            }}
          >
            loading narrative space...
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            background:     "radial-gradient(1200px 320px at 50% 10%, rgba(216,90,48,0.08), transparent 50%), #0A0C0E",
            padding:        16,
          }}
        >
          <div
            style={{
              border: "1px solid rgba(216,90,48,0.35)",
              background: "rgba(17,20,24,0.85)",
              borderRadius: 10,
              padding: "12px 14px",
              maxWidth: 520,
              width: "100%",
            }}
          >
            <div style={{ color: "#E24B4A", fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Map renderer error
            </div>
            <div style={{ color: "#C8D3E0", fontSize: 12, lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
              The canvas failed to initialize. Try reloading this page. If the issue persists, use the legend below to continue filtering narratives while the renderer recovers.
            </div>
            <div style={{ color: "#8A9BB0", fontSize: 10, fontFamily: "var(--font-mono)", marginTop: 8 }}>
              detail: {error}
            </div>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip.visible && !loading && (
        <div
          style={{
            position:    "absolute",
            left:        tooltip.x,
            top:         tooltip.y,
            background:  "#111418",
            border:      "1px solid #1E2530",
            borderRadius: 6,
            padding:     "6px 10px",
            pointerEvents: "none",
            fontSize:    11,
            fontFamily:  "var(--font-mono)",
            lineHeight:  1.6,
            zIndex:      10,
            minWidth:    140,
            maxWidth:    220,
          }}
        >
          <div style={{ color: "#E2E8F0", fontWeight: 500 }}>
            {tooltip.topicName}
          </div>
          <div style={{ color: "#4A5568", marginTop: 2 }}>
            {tooltip.postId.slice(0, 16)}…
          </div>
          <div style={{ color: "#8A9BB0", marginTop: 1 }}>
            score: {tooltip.score.toLocaleString()}
          </div>
        </div>
      )}

      {/* Controls hint — bottom left */}
      {!loading && (
        <div
          style={{
            position:   "absolute",
            bottom:     12,
            left:       14,
            fontSize:   10,
            color:      "#2A3340",
            fontFamily: "var(--font-mono)",
            lineHeight: 1.8,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          scroll to zoom · drag to pan · click label to filter
        </div>
      )}
    </div>
  );
}

// ── Loading animation — three pulsing dots ────────────────────────────────────
function CanvasLoadingIndicator() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width:            6,
            height:           6,
            borderRadius:     "50%",
            background:       "#1D9E75",
            animation:        `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}