// FILE: components/CoordHeatmap.tsx
"use client";

/**
 * CoordHeatmap.tsx — Coordinated behavior visualization.
 *
 * Shows a sorted matrix of account pairs × time buckets (monthly),
 * where each cell is colored by the synchronization score for that
 * account in that month.
 *
 * "Synchronized" means: two accounts shared the same URL within a
 * 30-minute window more than 3 times (scripts/05_coord.py).
 *
 * Design decisions:
 *   - Rows = top 40 most-synchronized accounts (sorted by total sync score)
 *   - Columns = monthly time buckets (Jan 2019 – Dec 2023)
 *   - Cell color = sync event count (teal scale, opacity encodes intensity)
 *   - Click cell → show the specific shared URLs and post IDs
 *   - Hover row → highlight all months for that account
 *
 * The heatmap is rendered with Canvas (not SVG) to handle 40×60 = 2400 cells
 * without DOM performance issues. Each cell is drawn as a rounded rect.
 *
 * Important caveat (shown in UI): this detects correlation, not intent.
 * False positives include:
 *   - Moderators cross-posting to sister subreddits
 *   - Accounts responding to the same breaking news event
 *   - Mutual friends sharing the same viral link simultaneously
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoordCell {
  account: string;
  month:   string;  // "YYYY-MM"
  count:   number;  // sync event count in that month
}

interface CoordPair {
  account_a:   string;
  account_b:   string;
  sync_count:  number;
  avg_gap_min: number;
  shared_urls: string[];
}

interface HeatmapData {
  accounts:  string[];
  months:    string[];
  cells:     CoordCell[];
  top_pairs: CoordPair[];
}

interface CellDetail {
  account: string;
  month:   string;
  count:   number;
  x:       number;
  y:       number;
}

interface Props {
  data:   HeatmapData | null;
  width:  number;
  height: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CELL_GAP   = 2;
const ROW_LABEL_W = 130;
const COL_LABEL_H = 28;
const MIN_CELL_W  = 8;
const MIN_CELL_H  = 16;

// ── Canvas renderer ───────────────────────────────────────────────────────────

export default function CoordHeatmap({ data, width, height }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [hovered,  setHovered]  = useState<CellDetail | null>(null);
  const [selected, setSelected] = useState<CellDetail | null>(null);

  // Derived layout metrics
  const layout = useMemo(() => {
    if (!data || !data.accounts.length || !data.months.length) return null;

    const numRows = data.accounts.length;
    const numCols = data.months.length;

    const gridW  = width - ROW_LABEL_W - 16;
    const gridH  = height - COL_LABEL_H - 16;

    const cellW = Math.max(
      MIN_CELL_W,
      Math.min(
        40,
        Math.floor((gridW - (numCols - 1) * CELL_GAP) / numCols)
      )
    );
    const cellH = Math.max(
      MIN_CELL_H,
      Math.min(
        60,
        Math.floor((gridH - (numRows - 1) * CELL_GAP) / numRows)
      )
    );

    // Build lookup: account+month → count
    const cellMap = new Map<string, number>();
    for (const cell of data.cells) {
      cellMap.set(`${cell.account}__${cell.month}`, cell.count);
    }

    // Max count for color scale
    const maxCount = Math.max(1, ...data.cells.map((c) => c.count));

    return { numRows, numCols, cellW, cellH, cellMap, maxCount, gridW, gridH };
  }, [data, width, height]);

  // Draw on canvas
  const draw = useCallback(() => {
    if (!canvasRef.current || !data || !layout) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Always reset canvas dimensions completely
    canvas.width  = Math.floor(width  * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width  = width  + "px";
    canvas.style.height = height + "px";

    // Reset transform before scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#0A0C0E";
    ctx.fillRect(0, 0, width, height);

    const { cellW, cellH, cellMap, maxCount } = layout;

    // Draw column labels (month names)
    ctx.font        = "9px ui-monospace, monospace";
    ctx.fillStyle   = "#3A4148";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";

    data.months.forEach((month, ci) => {
      const x = ROW_LABEL_W + ci * (cellW + CELL_GAP) + cellW / 2;
      // Only show year labels (Jan of each year)
      if (month.endsWith("-01")) {
        ctx.fillStyle = "#4A5568";
        ctx.fillText(month.slice(0, 4), x, COL_LABEL_H / 2);
      }
    });

    // Draw rows
    data.accounts.forEach((account, ri) => {
      const y = COL_LABEL_H + ri * (cellH + CELL_GAP);

      // Row label
      ctx.textAlign    = "right";
      ctx.textBaseline = "middle";
      ctx.font         = "10px ui-monospace, monospace";
      ctx.fillStyle    =
        hovered?.account === account || selected?.account === account
          ? "#A0AEC0"
          : "#4A5568";

      const labelText = account.length > 16
        ? account.slice(0, 14) + "…"
        : account;
      ctx.fillText(labelText, ROW_LABEL_W - 6, y + cellH / 2);

      // Cells
      data.months.forEach((month, ci) => {
        const cx    = ROW_LABEL_W + ci * (cellW + CELL_GAP);
        const count = cellMap.get(`${account}__${month}`) ?? 0;

        // Color: teal at full saturation for max count, near-invisible for 0
        const intensity = count / maxCount;
        const alpha     = count === 0 ? 0.06 : 0.2 + intensity * 0.8;

        // Highlight row on hover
        const isHoveredRow =
          hovered?.account === account || selected?.account === account;

        ctx.fillStyle =
          count === 0
            ? `rgba(26, 37, 48, ${isHoveredRow ? 0.5 : 0.3})`
            : `rgba(29, 158, 117, ${alpha})`;

        // Rounded rect
        const r = Math.min(2, cellW / 4, cellH / 4);
        ctx.beginPath();
        ctx.roundRect(cx, y, cellW, cellH, r);
        ctx.fill();

        // Highlight selected cell
        if (selected?.account === account && selected?.month === month) {
          ctx.strokeStyle = "#1D9E75";
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      });
    });
  }, [data, layout, width, height, hovered, selected]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse event handling
  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): CellDetail | null => {
      if (!data || !layout) return null;

      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;

      const { cellW, cellH } = layout;

      // Check if inside grid area
      if (mx < ROW_LABEL_W || my < COL_LABEL_H) return null;

      const ci = Math.floor((mx - ROW_LABEL_W) / (cellW + CELL_GAP));
      const ri = Math.floor((my - COL_LABEL_H) / (cellH + CELL_GAP));

      if (ci < 0 || ci >= data.months.length)   return null;
      if (ri < 0 || ri >= data.accounts.length)  return null;

      const account = data.accounts[ri];
      const month   = data.months[ci];
      const count   = layout.cellMap.get(`${account}__${month}`) ?? 0;

      return {
        account,
        month,
        count,
        x: ROW_LABEL_W + ci * (cellW + CELL_GAP),
        y: COL_LABEL_H  + ri * (cellH + CELL_GAP),
      };
    },
    [data, layout]
  );

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    setHovered(getCellFromEvent(e));
  }

  function handleMouseLeave() {
    setHovered(null);
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const cell = getCellFromEvent(e);
    setSelected((prev) =>
      prev?.account === cell?.account && prev?.month === cell?.month
        ? null
        : cell
    );
  }

  // Find pairs involving the selected account
  const selectedPairs = useMemo(() => {
    if (!selected || !data) return [];
    return data.top_pairs.filter(
      (p) =>
        p.account_a === selected.account ||
        p.account_b === selected.account
    );
  }, [selected, data]);

  if (!data) {
    return (
      <div
        style={{
          width,
          height,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          color:          "#3A4148",
          fontSize:       12,
          fontFamily:     "monospace",
        }}
      >
        no coordination data loaded
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Canvas heatmap */}
      <canvas
        ref={canvasRef}
        style={{
          width:   "100%",
          height:  "100%",
          cursor:  "crosshair",
          display: "block",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />

      {/* Hover tooltip */}
      {hovered && hovered.count > 0 && (
        <div
          style={{
            position:      "absolute",
            left:          hovered.x + (layout?.cellW ?? 10) + 6,
            top:           hovered.y,
            background:    "#111418",
            border:        "1px solid #1E2530",
            borderRadius:  8,
            padding:       "7px 11px",
            pointerEvents: "none",
            zIndex:        20,
            minWidth:      160,
          }}
        >
          <div
            style={{
              fontSize:    11,
              fontWeight:  500,
              color:       "#E2E8F0",
              marginBottom: 3,
            }}
          >
            {hovered.account}
          </div>
          <div
            style={{
              fontSize:   10,
              color:      "#4A5568",
              fontFamily: "monospace",
            }}
          >
            {hovered.month}
          </div>
          <div
            style={{
              fontSize:   11,
              color:      "#1D9E75",
              fontFamily: "monospace",
              marginTop:  4,
            }}
          >
            {hovered.count} sync event{hovered.count !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Selected account detail panel */}
      {selected && (
        <div
          style={{
            borderTop:   "1px solid #1E2530",
            padding:     "10px 14px",
            background:  "#0D1014",
            display:     "flex",
            gap:         16,
            alignItems:  "flex-start",
            flexShrink:  0,
          }}
        >
          <div>
            <div
              style={{
                fontSize:   10,
                color:      "#4A5568",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              selected account
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0", fontFamily: "monospace" }}>
              {selected.account}
            </div>
            <div style={{ fontSize: 11, color: "#4A5568", fontFamily: "monospace", marginTop: 2 }}>
              {selected.month} · {selected.count} sync events
            </div>
          </div>

          {selectedPairs.length > 0 && (
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize:   10,
                  color:      "#4A5568",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                coordinated with
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selectedPairs.slice(0, 5).map((pair) => {
                  const partner =
                    pair.account_a === selected.account
                      ? pair.account_b
                      : pair.account_a;
                  return (
                    <div
                      key={partner}
                      style={{
                        padding:      "2px 8px",
                        borderRadius: 14,
                        border:       "1px solid #1E2530",
                        background:   "rgba(29,158,117,0.08)",
                        fontSize:     11,
                        color:        "#1D9E75",
                        fontFamily:   "monospace",
                      }}
                    >
                      {partner} ({pair.sync_count}×)
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => setSelected(null)}
            style={{
              background: "none",
              border:     "none",
              color:      "#4A5568",
              cursor:     "pointer",
              fontSize:   16,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Caveat footer */}
      <div
        style={{
          position:   "absolute",
          bottom:     selected ? 130 : 8,
          left:       ROW_LABEL_W + 4,
          fontSize:   9,
          color:      "#2A3340",
          fontFamily: "monospace",
          pointerEvents: "none",
        }}
      >
        correlation ≠ coordination · false positives include cross-posting mods + news-event synchronisation
      </div>
    </div>
  );
}