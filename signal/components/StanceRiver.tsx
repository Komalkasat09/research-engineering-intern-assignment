// FILE: components/StanceRiver.tsx
"use client";

/**
 * StanceRiver.tsx — D3 v7 streamgraph of pro/neutral/con stance over time.
 *
 * The stance data comes from zero-shot NLI classification (scripts/04_stance.py).
 * For each post, the model evaluates the premise:
 *   "This post expresses a progressive or left-leaning political position."
 *   → entailment > 0.55  = "pro"
 *   → contradiction > 0.55 = "con"
 *   → otherwise           = "neutral"
 *
 * The streamgraph uses D3's stack() with d3.stackOffsetSilhouette — this
 * centers the streams on the zero axis, making expansion/contraction of
 * each stance visually clear. A narrative going from "progressive consensus" to
 * "contested terrain" shows as the coral (con) stream growing.
 *
 * Color encoding (matches global Signal palette):
 *   Teal  = progressive
 *   Gray  = neutral/moderate
 *   Coral = conservative/contra
 *
 * Interactions:
 *   Hover stream → highlight + show weekly breakdown tooltip
 *   Click stream → filter to that stance in Zustand (future use)
 *   Brush        → date range selection (syncs to store)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import * as d3 from "d3";
import type { StancePoint } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  data:     StancePoint[];
  width:    number;
  height:   number;
  topicId?: number;
}

interface TooltipState {
  visible: boolean;
  x:       number;
  y:       number;
  week:    string;
  pro:     number;
  neutral: number;
  con:     number;
  n:       number;
}

// ── Week string → Date ────────────────────────────────────────────────────────
function weekToDate(w: string): Date {
  // Newer pipeline emits range labels like 2024-07-22/2024-07-28.
  if (w.includes("/")) {
    const start = new Date(w.split("/")[0]);
    if (!Number.isNaN(start.getTime())) return start;
  }

  // Backward compatibility with labels like 2024-W31.
  const [year, week] = w.split("-W").map(Number);
  if (Number.isFinite(year) && Number.isFinite(week)) {
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
    return monday;
  }

  // Final fallback if data uses plain date strings.
  const direct = new Date(w);
  return Number.isNaN(direct.getTime()) ? new Date(0) : direct;
}

// ── Margins ───────────────────────────────────────────────────────────────────
const M = { top: 20, right: 20, bottom: 44, left: 48 };

// ── Stance color palette ──────────────────────────────────────────────────────
const STANCE_FILL: Record<string, string> = {
  pro:     "#1D9E75",
  neutral: "#3A4148",
  con:     "#D85A30",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StanceRiver({ data, width, height }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, week: "", pro: 0, neutral: 0, con: 0, n: 0,
  });

  const build = useCallback(() => {
    if (!svgRef.current || !data.length) return;

    const W = width  - M.left - M.right;
    const H = height - M.top  - M.bottom;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width",  width)
      .attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    // ── Prepare data ────────────────────────────────────────────────
    // Aggregate by week (sum across all topics if not filtered)
    const byWeek = d3.rollup(
      data,
      (rows) => ({
        week:    rows[0].week,
        pro:     d3.mean(rows, (d) => d.pro) ?? 0,
        neutral: d3.mean(rows, (d) => d.neutral) ?? 0,
        con:     d3.mean(rows, (d) => d.con) ?? 0,
        n:       d3.sum(rows, (d) => d.n),
      }),
      (d) => d.week
    );

    const sorted = Array.from(byWeek.values())
      .sort((a, b) => weekToDate(a.week).getTime() - weekToDate(b.week).getTime());

    if (sorted.length < 2) return;

    // ── Scales ──────────────────────────────────────────────────────
    const xDomain = d3.extent(sorted, (d) => weekToDate(d.week)) as [Date, Date];
    const x = d3.scaleTime().domain(xDomain).range([0, W]);
    const y = d3.scaleLinear().range([H, 0]);  // domain set after stacking

    // ── Stack ────────────────────────────────────────────────────────
    // stackOffsetSilhouette centers the stacked area on zero — this is
    // the classic "river" or "streamgraph" style
    const stack = d3
      .stack<{ week: string; pro: number; neutral: number; con: number; n: number }>()
      .keys(["pro", "neutral", "con"])
      .offset(d3.stackOffsetSilhouette)
      .order(d3.stackOrderInsideOut);

    const series = stack(sorted);

    // Set y domain from stacked extents
    const yExtent = [
      d3.min(series, (s) => d3.min(s, (d) => d[0])) ?? -0.5,
      d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 0.5,
    ] as [number, number];
    y.domain(yExtent);

    // ── Grid lines ───────────────────────────────────────────────────
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y)
          .tickSize(-W)
          .tickFormat(() => "")
          .ticks(4)
      )
      .call((gr) => gr.select(".domain").remove())
      .call((gr) =>
        gr.selectAll("line")
          .attr("stroke", "#1E2530")
          .attr("stroke-dasharray", "3 3")
      );

    // ── X axis ───────────────────────────────────────────────────────
    g.append("g")
      .attr("transform", `translate(0,${H})`)
      .call(
        d3.axisBottom(x)
          .ticks(d3.timeYear.every(1))
          .tickFormat((d) => d3.timeFormat("%Y")(d as Date))
      )
      .call((gr) => gr.select(".domain").attr("stroke", "#1E2530"))
      .call((gr) =>
        gr.selectAll("text")
          .attr("fill",       "#4A5568")
          .attr("font-size",  "11px")
          .attr("font-family","var(--font-mono, monospace)")
      )
      .call((gr) => gr.selectAll(".tick line").attr("stroke", "#1E2530"));

    // ── Streams ──────────────────────────────────────────────────────
    const area = d3
      .area<d3.SeriesPoint<{ week: string; pro: number; neutral: number; con: number; n: number }>>()
      .x((d) => x(weekToDate((d.data as { week: string }).week)))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5));

    const streamGroup = g.append("g");

    series.forEach((s) => {
      const key = s.key as "pro" | "neutral" | "con";

      streamGroup
        .append("path")
        .datum(s)
        .attr("class", `stream stream-${key}`)
        .attr("fill",         STANCE_FILL[key])
        .attr("fill-opacity", 0.75)
        .attr("stroke",       STANCE_FILL[key])
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.4)
        .attr("d",            area)
        .style("cursor",      "pointer")
        .on("mouseover", function () {
          d3.select(this).attr("fill-opacity", 0.95);
          // Dim other streams
          streamGroup.selectAll(`.stream:not(.stream-${key})`)
            .attr("fill-opacity", 0.2);
        })
        .on("mousemove", function (event: MouseEvent) {
          const [mx] = d3.pointer(event);
          const hoverDate = x.invert(mx);
          // Find closest data point
          const bisect = d3.bisector((d: { week: string }) => weekToDate(d.week)).center;
          const idx    = bisect(sorted, hoverDate);
          if (idx < 0 || idx >= sorted.length) return;
          const pt     = sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
          setTooltip({
            visible: true,
            x:       event.offsetX + 14,
            y:       event.offsetY - 10,
            week:    pt.week,
            pro:     pt.pro,
            neutral: pt.neutral,
            con:     pt.con,
            n:       pt.n,
          });
        })
        .on("mouseleave", function () {
          d3.select(this).attr("fill-opacity", 0.75);
          streamGroup.selectAll(".stream").attr("fill-opacity", 0.75);
          setTooltip((t) => ({ ...t, visible: false }));
        });
    });

    // ── Zero line ────────────────────────────────────────────────────
    g.append("line")
      .attr("x1", 0).attr("x2", W)
      .attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke",         "#3A4148")
      .attr("stroke-width",   0.5)
      .attr("stroke-dasharray","4 2");

    // ── Legend labels inline ─────────────────────────────────────────
    // Place labels at the end of each stream
    const lastPt = sorted[sorted.length - 1];
    const stackLast = stack([lastPt]);

    stackLast.forEach((s) => {
      const midY = (y(s[0][0]) + y(s[0][1])) / 2;
      const key  = s.key as "pro" | "neutral" | "con";
      const label: Record<string, string> = {
        pro:     "progressive",
        neutral: "neutral / moderate",
        con:     "conservative",
      };

      g.append("text")
        .attr("x",           W - 4)
        .attr("y",           midY)
        .attr("text-anchor", "end")
        .attr("fill",        STANCE_FILL[key])
        .attr("font-size",   "10px")
        .attr("font-family", "var(--font-mono, monospace)")
        .attr("dominant-baseline", "central")
        .attr("opacity",     0.8)
        .text(label[key] ?? key);
    });

  }, [data, width, height]);

  useEffect(() => { build(); }, [build]);

  return (
    <div style={{ position: "relative", width, height }}>
      <svg ref={svgRef} style={{ overflow: "visible" }} />

      {/* Tooltip */}
      {tooltip.visible && (
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
            zIndex:        30,
            minWidth:      160,
          }}
        >
          <div
            style={{
              fontSize:    10,
              color:       "#4A5568",
              fontFamily:  "monospace",
              marginBottom: 6,
            }}
          >
            {tooltip.week} · {tooltip.n.toLocaleString()} posts
          </div>
          {(
            [
              { key: "pro",     label: "progressive",           color: "#1D9E75" },
              { key: "neutral", label: "neutral / moderate",    color: "#3A4148" },
              { key: "con",     label: "conservative / contra", color: "#D85A30" },
            ] as const
          ).map((s) => (
            <div
              key={s.key}
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        8,
                marginTop:  2,
              }}
            >
              <div
                style={{
                  width:        8,
                  height:       8,
                  borderRadius: "50%",
                  background:   s.color,
                  flexShrink:   0,
                }}
              />
              <span style={{ fontSize: 11, color: "#8A9BB0", flex: 1 }}>
                {s.label}
              </span>
              <span
                style={{
                  fontSize:   11,
                  color:      "#E2E8F0",
                  fontFamily: "monospace",
                }}
              >
                {(tooltip[s.key] * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}