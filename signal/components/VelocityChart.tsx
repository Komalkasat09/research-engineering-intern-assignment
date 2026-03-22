"use client";

/**
 * VelocityChart.tsx — D3 multi-line narrative velocity chart with event pins.
 *
 * What it shows:
 *   - Y axis: narrative velocity (cosine distance between weekly centroids)
 *   - X axis: time (weeks, 2019–2023)
 *   - Lines: one per topic cluster, colored by topic
 *   - Event pins: vertical lines at key real-world events (COP, IPCC, etc.)
 *   - Brush: drag to select a date range → syncs to Zustand store
 *   - Hover: tooltip shows velocity value + post count at that week
 *
 * D3 pattern used: proper useRef + useEffect, no "D3 vs React" state fights.
 * React owns the DOM node via ref. D3 owns everything inside it.
 * We re-run the full D3 build when data or dimensions change.
 */

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { WikiEvent } from "@/lib/wikiEvents";
import { useSignalStore } from "@/lib/store";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VelocityPoint {
  week:       string;   // "2022-W03"
  topic_id:   number;
  velocity:   number;   // 0–1 cosine distance
  post_count: number;
}

interface Props {
  data:    VelocityPoint[];
  events:  WikiEvent[];
  width:   number;
  height:  number;
  topicColors: Record<number, string>;
  topicNames:  Record<number, string>;
}

// ── Margins ──────────────────────────────────────────────────────────────────
const M = { top: 20, right: 24, bottom: 60, left: 52 };

// ── Week string → Date (Monday of that ISO week) ──────────────────────────────
function weekToDate(w: string): Date {
  const [year, week] = w.split("-W").map(Number);
  // Jan 4 is always in week 1 of the ISO year
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;  // 1=Mon … 7=Sun
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VelocityChart({
  data,
  events,
  width,
  height,
  topicColors,
  topicNames,
}: Props) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const tipRef    = useRef<HTMLDivElement>(null);
  const { activeTopic, setActiveTopic, setDateRange } = useSignalStore();

  const buildChart = useCallback(() => {
    if (!svgRef.current || data.length === 0) return;

    const W = width  - M.left - M.right;
    const H = height - M.top  - M.bottom;

    // ── Clear previous render ──────────────────────────────────────────────
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width",  width)
      .attr("height", height);

    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);

    // ── Scales ────────────────────────────────────────────────────────────
    // Convert week strings → Dates
    const allDates = data.map((d) => weekToDate(d.week));
    const xDomain  = d3.extent(allDates) as [Date, Date];

    const x = d3.scaleTime().domain(xDomain).range([0, W]);
    const y = d3.scaleLinear().domain([0, 0.55]).range([H, 0]).nice();

    // ── Grid lines ────────────────────────────────────────────────────────
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y)
          .tickSize(-W)
          .tickFormat(() => "")
          .ticks(5)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll("line")
          .attr("stroke", "#1E2530")
          .attr("stroke-dasharray", "3 3")
      );

    // ── Axes ──────────────────────────────────────────────────────────────
    // X axis
    g.append("g")
      .attr("transform", `translate(0,${H})`)
      .call(
        d3.axisBottom(x)
          .ticks(d3.timeYear.every(1))
          .tickFormat((d) => d3.timeFormat("%Y")(d as Date))
      )
      .call((g) => g.select(".domain").attr("stroke", "#1E2530"))
      .call((g) =>
        g.selectAll("text")
          .attr("fill", "#4A5568")
          .attr("font-size", "11px")
          .attr("font-family", "var(--font-mono)")
      )
      .call((g) => g.selectAll("tick line").attr("stroke", "#1E2530"));

    // Y axis
    g.append("g")
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `${(+d).toFixed(2)}`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll("text")
          .attr("fill", "#4A5568")
          .attr("font-size", "10px")
          .attr("font-family", "var(--font-mono)")
      );

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -H / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#3A4148")
      .attr("font-size", "10px")
      .attr("font-family", "var(--font-mono)")
      .text("velocity (cosine drift)");

    // ── Event pins ────────────────────────────────────────────────────────
    const eventGroup = g.append("g").attr("class", "events");

    events.forEach((evt) => {
      const evtDate = new Date(evt.date);
      if (evtDate < xDomain[0] || evtDate > xDomain[1]) return;

      const ex = x(evtDate);

      // Vertical line
      eventGroup
        .append("line")
        .attr("x1", ex).attr("x2", ex)
        .attr("y1", 0)  .attr("y2", H)
        .attr("stroke",       evt.color)
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 3")
        .attr("opacity", 0.55);

      // Diamond marker at top
      eventGroup
        .append("polygon")
        .attr(
          "points",
          `${ex},${-8} ${ex + 5},${-2} ${ex},${4} ${ex - 5},${-2}`
        )
        .attr("fill",    evt.color)
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseover", function (mouseEvt) {
          showEventTip(mouseEvt, evt);
          d3.select(this).attr("opacity", 1).attr("transform", `scale(1.3)`);
        })
        .on("mouseout", function () {
          hideTip();
          d3.select(this).attr("opacity", 0.85).attr("transform", "scale(1)");
        })
        .on("click", () => window.open(evt.url, "_blank"));
    });

    // ── Velocity lines ────────────────────────────────────────────────────
    // Group data by topic
    const byTopic = d3.group(data, (d) => d.topic_id);

    const line = d3
      .line<VelocityPoint>()
      .x((d) => x(weekToDate(d.week)))
      .y((d) => y(d.velocity))
      .curve(d3.curveCatmullRom.alpha(0.5))
      .defined((d) => !isNaN(d.velocity));

    byTopic.forEach((points, topicId) => {
      const sorted = [...points].sort((a, b) =>
        weekToDate(a.week).getTime() - weekToDate(b.week).getTime()
      );

      const color = topicColors[topicId] ?? "#3A4148";
      const isActive = activeTopic === null || activeTopic === topicId;

      // Subtle area fill under each line
      const area = d3
        .area<VelocityPoint>()
        .x((d) => x(weekToDate(d.week)))
        .y0(H)
        .y1((d) => y(d.velocity))
        .curve(d3.curveCatmullRom.alpha(0.5))
        .defined((d) => !isNaN(d.velocity));

      g.append("path")
        .datum(sorted)
        .attr("class", `area area-${topicId}`)
        .attr("fill", color)
        .attr("fill-opacity", isActive ? 0.04 : 0.01)
        .attr("d", area);

      // The line itself
      const path = g
        .append("path")
        .datum(sorted)
        .attr("class", `line line-${topicId}`)
        .attr("fill",         "none")
        .attr("stroke",       color)
        .attr("stroke-width", activeTopic === topicId ? 2 : 1)
        .attr("opacity",      isActive ? (activeTopic === topicId ? 1 : 0.4) : 0.12)
        .attr("d",            line)
        .style("cursor",      "pointer");

      // Click line → set active topic
      path.on("click", () => {
        setActiveTopic(activeTopic === topicId ? null : topicId);
      });

      // Hover: raise this line
      path
        .on("mouseover", function () {
          d3.select(this)
            .attr("stroke-width", 2.5)
            .attr("opacity", 1)
            .raise();
        })
        .on("mouseout", function () {
          d3.select(this)
            .attr("stroke-width", activeTopic === topicId ? 2 : 1)
            .attr("opacity", isActive
              ? (activeTopic === topicId ? 1 : 0.4)
              : 0.12
            );
        });
    });

    // ── Hover crosshair + tooltip ─────────────────────────────────────────
    const bisect = d3.bisector((d: VelocityPoint) => weekToDate(d.week)).center;

    // Invisible overlay for mouse tracking
    const overlay = g
      .append("rect")
      .attr("width",   W)
      .attr("height",  H)
      .attr("fill",    "transparent")
      .style("cursor", "crosshair");

    const crosshairX = g
      .append("line")
      .attr("y1", 0).attr("y2", H)
      .attr("stroke",       "#2A3340")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .attr("opacity", 0);

    overlay.on("mousemove", function (event) {
      const [mx] = d3.pointer(event);
      const hoverDate = x.invert(mx);

      // Find the week closest to hover in the biggest topic's data
      const mainTopic = Array.from(byTopic.entries()).sort(
        (a, b) => b[1].length - a[1].length
      )[0];
      if (!mainTopic) return;

      const [, pts] = mainTopic;
      const sorted  = [...pts].sort(
        (a, b) => weekToDate(a.week).getTime() - weekToDate(b.week).getTime()
      );

      const idx  = bisect(sorted, hoverDate);
      if (idx < 0 || idx >= sorted.length) return;
      const pt   = sorted[idx];
      const ptX  = x(weekToDate(pt.week));

      crosshairX.attr("x1", ptX).attr("x2", ptX).attr("opacity", 1);

      showDataTip(event, pt, topicColors, topicNames, byTopic);
    });

    overlay.on("mouseleave", () => {
      crosshairX.attr("opacity", 0);
      hideTip();
    });

    // ── Brush for date range selection ────────────────────────────────────
    const brush = d3
      .brushX()
      .extent([[0, 0], [W, H]])
      .on("end", (event) => {
        if (!event.selection) return;
        const [x0, x1] = event.selection as [number, number];
        const d0 = x.invert(x0);
        const d1 = x.invert(x1);
        setDateRange(d0.getTime() / 1000, d1.getTime() / 1000);
        // Clear brush visual after selection
        g.select<SVGGElement>(".brush").call(brush.move, null);
      });

    const brushGroup = g.append("g").attr("class", "brush").call(brush);

    // Style the brush selection
    brushGroup.select(".selection")
      .attr("fill",         "#1D9E75")
      .attr("fill-opacity", 0.08)
      .attr("stroke",       "#1D9E75")
      .attr("stroke-width", 1);

    brushGroup.selectAll(".handle")
      .attr("fill", "#1D9E75")
      .attr("opacity", 0.4);

  }, [data, events, width, height, topicColors, topicNames, activeTopic, setActiveTopic, setDateRange]);

  useEffect(() => {
    buildChart();
  }, [buildChart]);

  // ── Tooltip helpers ───────────────────────────────────────────────────────
  function showEventTip(event: MouseEvent, evt: WikiEvent) {
    if (!tipRef.current) return;
    const tip = tipRef.current;
    tip.innerHTML = `
      <div style="font-weight:500;color:#E2E8F0;margin-bottom:4px">${evt.title}</div>
      <div style="font-size:10px;color:#1D9E75;font-family:var(--font-mono);margin-bottom:6px">${evt.date}</div>
      <div style="font-size:11px;color:#8A9BB0;line-height:1.5">${evt.description}</div>
    `;
    tip.style.left    = `${event.offsetX + 16}px`;
    tip.style.top     = `${event.offsetY - 10}px`;
    tip.style.opacity = "1";
  }

  function showDataTip(
    event: MouseEvent,
    pt: VelocityPoint,
    colors: Record<number, string>,
    names: Record<number, string>,
    byTopic: Map<number, VelocityPoint[]>
  ) {
    if (!tipRef.current) return;
    const tip = tipRef.current;

    // Collect velocity for all topics at this week
    const rows = Array.from(byTopic.entries())
      .map(([tid, pts]) => {
        const match = pts.find((p: VelocityPoint) => p.week === pt.week);
        return match ? { tid, velocity: match.velocity } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?.velocity ?? 0) - (a?.velocity ?? 0))
      .slice(0, 5);

    const rowHtml = rows
      .map(
        (r) => `
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
          <div style="width:6px;height:6px;border-radius:50%;background:${colors[r!.tid] ?? "#888"};flex-shrink:0"></div>
          <span style="color:#8A9BB0;font-size:11px;flex:1">${names[r!.tid] ?? `topic ${r!.tid}`}</span>
          <span style="color:#E2E8F0;font-family:var(--font-mono);font-size:11px">${r!.velocity.toFixed(3)}</span>
        </div>`
      )
      .join("");

    tip.innerHTML = `
      <div style="font-size:10px;color:#4A5568;font-family:var(--font-mono);margin-bottom:6px">${pt.week}</div>
      ${rowHtml}
    `;
    tip.style.left    = `${(event as MouseEvent & { offsetX: number }).offsetX + 16}px`;
    tip.style.top     = `${(event as MouseEvent & { offsetY: number }).offsetY - 10}px`;
    tip.style.opacity = "1";
  }

  function hideTip() {
    if (tipRef.current) tipRef.current.style.opacity = "0";
  }

  return (
    <div style={{ position: "relative", width, height }}>
      <svg ref={svgRef} style={{ overflow: "visible" }} />
      {/* Tooltip */}
      <div
        ref={tipRef}
        style={{
          position:      "absolute",
          pointerEvents: "none",
          background:    "#111418",
          border:        "1px solid #1E2530",
          borderRadius:  8,
          padding:       "8px 12px",
          minWidth:      180,
          maxWidth:      260,
          opacity:       0,
          transition:    "opacity 0.1s ease",
          zIndex:        30,
          fontSize:      12,
          lineHeight:    1.5,
        }}
      />
    </div>
  );
}