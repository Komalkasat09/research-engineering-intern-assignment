"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { DatasetMeta } from "@/types";
import { useSignalStore } from "@/lib/store";
import AnalystRail from "@/components/AnalystRail";

// ─── Nav config ──────────────────────────────────────────────────────────────
type NavItem = {
  href: string;
  label: string;
  dot: "teal" | "amber" | "purple" | "coral";
  badge?: string;
};

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Explore",
    items: [
      { href: "/explore",     label: "Explore workspace",     dot: "teal" },
      { href: "/graph",       label: "Spread graph",          dot: "amber" },
      // { href: "/globe",       label: "Globe",                 dot: "teal" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { href: "/analysis/lifecycle", label: "Narrative lifecycle",   dot: "teal" },
      { href: "/analysis/livefeed",  label: "Live feed injector",    dot: "coral" },
      { href: "/stance",      label: "Stance river",          dot: "amber" },
      { href: "/signals",     label: "Coord. behavior",       dot: "purple" },
      { href: "/fingerprint", label: "Narrative fingerprint", dot: "coral", badge: "AI" },
    ],
  },
  {
    title: "Investigate",
    items: [
      { href: "/chat",        label: "Ask Signal",            dot: "coral" },
      { href: "/posts",       label: "Posts explorer",        dot: "teal" },
      { href: "/benchmark",   label: "Benchmark",             dot: "amber" },
    ],
  },
];

// ─── Dot colors ───────────────────────────────────────────────────────────────
const DOT_COLORS: Record<string, string> = {
  teal:   "var(--teal)",
  amber:  "var(--amber)",
  purple: "var(--purple)",
  coral:  "var(--coral)",
};

// ─── Active class per dot color ───────────────────────────────────────────────
const ACTIVE_CLASS: Record<string, string> = {
  teal:   "active",
  amber:  "",
  purple: "",
  coral:  "",
};

// ─── Time range chips ─────────────────────────────────────────────────────────
const RANGES = ["Jul 2024", "Aug", "Sep", "Oct", "Nov", "Dec 2024", "Jan 2025", "All"];

function toUnix(value: string, endOfDay = false): number {
  const dt = new Date(value);
  if (endOfDay) dt.setUTCHours(23, 59, 59, 0);
  return Math.floor(dt.getTime() / 1000);
}

function resolveRange(range: string, meta: DatasetMeta | null): { start: number; end: number } {
  const mapped: Record<string, { start: string; end: string }> = {
    "Jul 2024": { start: "2024-07-01", end: "2024-07-31" },
    "Aug": { start: "2024-08-01", end: "2024-08-31" },
    "Sep": { start: "2024-09-01", end: "2024-09-30" },
    "Oct": { start: "2024-10-01", end: "2024-10-31" },
    "Nov": { start: "2024-11-01", end: "2024-11-30" },
    "Dec 2024": { start: "2024-12-01", end: "2024-12-31" },
    "Jan 2025": { start: "2025-01-01", end: "2025-01-31" },
  };

  if (range === "All") {
    return {
      start: toUnix(meta?.date_start ?? "2024-07-01"),
      end: toUnix(meta?.date_end ?? "2025-02-28", true),
    };
  }

  const value = mapped[range] ?? mapped["Jul 2024"];
  return {
    start: toUnix(value.start),
    end: toUnix(value.end, true),
  };
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const {
    activeTopic,
    setActiveTopic,
    activeRange,
    setActiveRange,
    setDateRange,
    platforms,
    togglePlatform,
    analystRailOpen,
    setAnalystRailOpen,
    opsTheme,
    toggleOpsTheme,
    meta,
    setMeta,
  } = useSignalStore();

  const safeActiveTopic = mounted ? activeTopic : null;
  const safeActiveRange = mounted ? activeRange : "All";
  const safePlatforms = mounted ? platforms : ["reddit", "twitter"];
  const safeAnalystRailOpen = mounted ? analystRailOpen : true;
  const safeOpsTheme = mounted ? opsTheme : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (meta) return;
    fetch("/api/clusters")
      .then((r) => r.json())
      .then((d) => {
        if (d?.meta) setMeta(d.meta);
      })
      .catch(() => {
        // Sidebar footer can render without metadata.
      });
  }, [meta, setMeta]);

  useEffect(() => {
    if (!mounted) return;
    const { start, end } = resolveRange(activeRange, meta);
    setDateRange(start, end);
  }, [activeRange, meta, mounted, setDateRange]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", opsTheme ? "ops" : "default");
  }, [opsTheme, mounted]);

  const postsLabel = mounted && meta ? meta.total_posts.toLocaleString() : "—";
  const rangeLabel = mounted && meta ? `${meta.date_start} – ${meta.date_end}` : "—";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: sidebarOpen
          ? `${224}px 1fr ${safeAnalystRailOpen ? "320px" : "0px"}`
          : `0px 1fr ${safeAnalystRailOpen ? "320px" : "0px"}`,
        gridTemplateRows: "var(--topbar-h) 1fr",
        height: "100dvh",
        overflow: "hidden",
        transition: "grid-template-columns 0.2s ease",
      }}
    >
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header
        className="scan-lines"
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          zIndex: 50,
        }}
      >
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 6px",
            color: "var(--muted)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flexShrink: 0,
          }}
          aria-label="Toggle sidebar"
        >
          {[0,1,2].map((i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: i === 1 ? 14 : 18,
                height: 1.5,
                background: "currentColor",
                borderRadius: 1,
                transition: "width 0.15s",
              }}
            />
          ))}
        </button>

        {/* Wordmark */}
        <Link
          href="/explore"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "baseline",
            gap: 1,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 16,
              fontWeight: 500,
              color: "var(--strong)",
              letterSpacing: "-0.5px",
            }}
          >
            signal
          </span>
          <span style={{ color: "var(--teal)", fontSize: 18, lineHeight: 1 }}>
            ◈
          </span>
        </Link>

        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--border-2)",
            flexShrink: 0,
          }}
        />

        {/* Case study label */}
        <span
          suppressHydrationWarning
          style={{
            fontSize: 12,
            color: "var(--dim)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.02em",
          }}
        >
          political discourse · cross-community mapping
        </span>

        {/* Live dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span className="dot-live" />
          <span style={{ fontSize: 11, color: "var(--muted)" }}>live</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Active topic badge */}
        {safeActiveTopic !== null && (
          <div
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          6,
              padding:      "3px 10px",
              borderRadius: 20,
              border:       "1px solid rgba(29,158,117,0.4)",
              background:   "rgba(29,158,117,0.1)",
              fontSize:     11,
              color:        "#1D9E75",
              fontFamily:   "var(--font-mono)",
              flexShrink:   0,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />
            topic #{safeActiveTopic}
            <button
              onClick={() => setActiveTopic(null)}
              aria-label="Clear topic filter"
              style={{
                background: "none",
                border:     "none",
                color:      "#1D9E75",
                cursor:     "pointer",
                fontSize:   14,
                lineHeight: 1,
                padding:    "0 0 0 2px",
                opacity:    0.7,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Time range chips */}
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {RANGES.map((r) => (
            <button
              key={r}
              className={clsx("chip", safeActiveRange === r && "active")}
              onClick={() => setActiveRange(r as typeof activeRange)}
              style={{ border: "none", background: "transparent" }}
            >
              {r}
            </button>
          ))}
        </div>

        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--border-2)",
            flexShrink: 0,
          }}
        />

        {/* Platform badges */}
        <div style={{ display: "flex", gap: 5 }}>
          <button
            className={clsx("chip", safePlatforms.includes("reddit") && "active")}
            onClick={() => togglePlatform("reddit")}
            style={{ border: "none", background: "transparent" }}
            aria-label="Toggle Reddit data"
          >
            Reddit
          </button>
          <button
            className={clsx("chip", safePlatforms.includes("twitter") && "active")}
            onClick={() => togglePlatform("twitter")}
            style={{ border: "none", background: "transparent" }}
            aria-label="Toggle Twitter/X data"
          >
            Twitter/X
          </button>
        </div>

        <button
          className={clsx("chip", safeAnalystRailOpen && "active")}
          onClick={() => setAnalystRailOpen(!analystRailOpen)}
          style={{ border: "none", background: "transparent" }}
          aria-label="Toggle analyst rail"
        >
          Rail
        </button>

        <button
          className={clsx("chip", safeOpsTheme && "active")}
          onClick={toggleOpsTheme}
          style={{ border: "none", background: "transparent" }}
          aria-label="Toggle ops theme"
        >
          Ops mode
        </button>
      </header>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        style={{
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          transition: "opacity 0.2s",
          opacity: sidebarOpen ? 1 : 0,
        }}
      >
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} style={{ marginBottom: 4 }}>
              {/* Section header */}
              <div
                style={{
                  padding: "10px 16px 4px",
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.7px",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                {section.title}
              </div>

              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx("nav-item", isActive && "active")}
                    style={
                      isActive
                        ? {
                            color:           DOT_COLORS[item.dot],
                            borderLeftColor: DOT_COLORS[item.dot],
                            background:      `${DOT_COLORS[item.dot]}18`,
                          }
                        : undefined
                    }
                  >
                    {/* Colored dot */}
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: isActive
                          ? DOT_COLORS[item.dot]
                          : "var(--border-2)",
                        flexShrink: 0,
                        transition: "background 0.15s",
                      }}
                    />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 500,
                          letterSpacing: "0.5px",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: 10,
                          background: "var(--teal-glow)",
                          color: "var(--teal)",
                          border: "1px solid var(--teal-dim)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Dataset footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            Dataset
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--body)",
              lineHeight: 1.8,
            }}
          >
            <div>{postsLabel} posts</div>
            <div style={{ color: "var(--subtle)" }}>Reddit</div>
            <div style={{ color: "var(--subtle)" }}>{rangeLabel}</div>
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span className="dot-live" style={{ width: 5, height: 5 }} />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              indexed from clusters metadata
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main content area ───────────────────────────────────────────── */}
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        {children}
      </main>

      <AnalystRail open={safeAnalystRailOpen} onClose={() => setAnalystRailOpen(false)} />
    </div>
  );
}