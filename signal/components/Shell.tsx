"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { useSignalStore } from "@/lib/store";

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
      { href: "/map",         label: "Narrative map",         dot: "teal" },
      { href: "/timeline",    label: "Timeline",              dot: "teal" },
      { href: "/graph",       label: "Spread graph",          dot: "teal" },
      { href: "/origins",     label: "Narrative origins",     dot: "purple" },
      { href: "/trends",      label: "Trends",                dot: "coral" },
      { href: "/globe",       label: "Globe",                 dot: "teal" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { href: "/stance",      label: "Stance river",          dot: "amber" },
      { href: "/signals",     label: "Coord. behavior",       dot: "purple" },
      { href: "/fingerprint", label: "Narrative fingerprint", dot: "coral", badge: "AI" },
    ],
  },
  {
    title: "Investigate",
    items: [
      { href: "/chat",        label: "Ask Signal",            dot: "coral" },
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

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [activeRange, setActiveRange] = useState("All");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { activeTopic, setActiveTopic, meta, setMeta } = useSignalStore();

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

  const postsLabel = mounted && meta ? meta.total_posts.toLocaleString() : "—";
  const rangeLabel = mounted && meta ? `${meta.date_start} – ${meta.date_end}` : "—";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: sidebarOpen ? `${224}px 1fr` : "0px 1fr",
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
          href="/map"
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
        {activeTopic !== null && (
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
            topic #{activeTopic}
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
              className={clsx("chip", activeRange === r && "active")}
              onClick={() => setActiveRange(r)}
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
          {["Reddit", "Twitter/X"].map((p) => (
            <span
              key={p}
              className="chip active"
              style={{ pointerEvents: "none", cursor: "default" }}
            >
              {p}
            </span>
          ))}
        </div>
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
    </div>
  );
}