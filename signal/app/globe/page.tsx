"use client";

/**
 * /globe — 3D geospatial intelligence view.
 *
 * The Three.js globe is isolated in an iframe (public/globe-embed.html)
 * to avoid SSR issues with WebGL globals. Communication via postMessage.
 */

import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import StatRow from "@/components/StatRow";
import { useSignalStore } from "@/lib/store";
import type { GlobeEvent } from "@/types";

const EVENT_TYPES = ["all", "cop", "protest", "disaster", "report", "policy"] as const;
type EventType = typeof EVENT_TYPES[number];

const TYPE_COLORS: Record<string, string> = {
  cop:      "#1D9E75",
  protest:  "#BA7517",
  disaster: "#D85A30",
  report:   "#7F77DD",
  policy:   "#378ADD",
};

export default function GlobePage() {
  const { activeTopic } = useSignalStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [events,       setEvents]       = useState<GlobeEvent[]>([]);
  const [typeFilter,   setTypeFilter]   = useState<EventType>("all");
  const [selectedEvt,  setSelectedEvt]  = useState<GlobeEvent | null>(null);
  const [loading,      setLoading]      = useState(true);

  // Load events from API
  useEffect(() => {
    fetch("/api/globe")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data as GlobeEvent[]);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  // Listen for EVENT_CLICK from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "EVENT_CLICK") {
        const evt = events.find((ev) => ev.id === e.data.id);
        if (evt) setSelectedEvt(evt);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [events]);

  // Send filter to iframe when typeFilter changes
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "SET_FILTER", topicId: activeTopic, typeFilter: typeFilter === "all" ? null : typeFilter },
      "*"
    );
  }, [typeFilter, activeTopic]);

  const filteredEvents = typeFilter === "all"
    ? events
    : events.filter((e) => e.type === typeFilter);

  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Globe</span>
        <span className="page-header__meta">
          geospatial intelligence · {events.length} political and civic events
        </span>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <StatRow
          stats={[
            { label: "Events", value: String(events.length), delta: "real-world political events", mono: true },
            { label: "Elections", value: String(events.filter(e => e.type === "cop").length), delta: "institutional milestones", mono: true },
            { label: "Reports", value: String(events.filter(e => e.type === "report").length), delta: "media and legal waves", mono: true },
            { label: "Protests", value: String(events.filter(e => e.type === "protest").length), delta: "civic mobilization", mono: true },
          ]}
        />
      </div>

      <div
        style={{
          flex:          1,
          minHeight:     0,
          margin:        "12px 24px 0",
          display:       "flex",
          gap:           10,
          paddingBottom: 16,
        }}
      >
        {/* Globe iframe */}
        <div
          style={{
            flex:         1,
            minHeight:    300,
            position:     "relative",
            borderRadius: "var(--radius-md)",
            overflow:     "hidden",
            border:       "1px solid var(--border)",
            background:   "#0A0C0E",
          }}
        >
          <iframe
            ref={iframeRef}
            src="/globe-embed.html"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Signal Globe"
            allow="scripts"
          />

          {/* Type filter chips overlay */}
          <div
            style={{
              position:   "absolute",
              top:        10,
              left:       10,
              display:    "flex",
              gap:        5,
              flexWrap:   "wrap",
            }}
          >
            {EVENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                style={{
                  padding:      "3px 10px",
                  borderRadius: 20,
                  border:       `1px solid ${typeFilter === t ? (TYPE_COLORS[t] ?? "#0F6E56") : "#1E2530"}`,
                  background:   typeFilter === t ? `${TYPE_COLORS[t] ?? "#1D9E75"}22` : "rgba(10,12,14,0.8)",
                  color:        typeFilter === t ? (TYPE_COLORS[t] ?? "#1D9E75") : "#8A9BB0",
                  fontSize:     10,
                  fontFamily:   "var(--font-mono)",
                  cursor:       "pointer",
                  transition:   "all 150ms ease",
                  backdropFilter: "blur(4px)",
                }}
              >
                {t === "cop" ? "election" : t}
              </button>
            ))}
          </div>
        </div>

        {/* Event list panel */}
        <div
          style={{
            width:        240,
            flexShrink:   0,
            display:      "flex",
            flexDirection:"column",
            gap:          6,
            overflowY:    "auto",
          }}
        >
          {/* Selected event detail */}
          {selectedEvt && (
            <div
              style={{
                background:   "#111418",
                border:       `1px solid ${selectedEvt.color}44`,
                borderRadius: "var(--radius-md)",
                padding:      "10px 12px",
                flexShrink:   0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div
                  style={{
                    width:        8,
                    height:       8,
                    borderRadius: "50%",
                    background:   selectedEvt.color,
                    marginTop:    3,
                    flexShrink:   0,
                  }}
                />
                <button
                  onClick={() => setSelectedEvt(null)}
                  style={{ background: "none", border: "none", color: "#4A5568", cursor: "pointer", fontSize: 14 }}
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#E2E8F0", marginBottom: 4 }}>
                {selectedEvt.title}
              </div>
              <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                {selectedEvt.date} · {selectedEvt.type}
              </div>
              <div style={{ fontSize: 10, color: "#4A5568", fontFamily: "var(--font-mono)" }}>
                intensity: {selectedEvt.intensity}/10
              </div>
            </div>
          )}

          {/* Event list */}
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow:     "hidden",
              flex:         1,
            }}
          >
            <div
              style={{
                padding:      "8px 10px",
                borderBottom: "1px solid var(--border)",
                fontSize:     9,
                color:        "#3A4148",
                textTransform:"uppercase",
                letterSpacing:"0.08em",
                fontFamily:   "var(--font-mono)",
              }}
            >
              {filteredEvents.length} events
            </div>
            <div style={{ overflowY: "auto", maxHeight: 400 }}>
              {loading ? (
                <div style={{ padding: "12px 10px", fontSize: 11, color: "#3A4148", fontFamily: "var(--font-mono)" }}>
                  loading…
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => {
                        setSelectedEvt(evt);
                        iframeRef.current?.contentWindow?.postMessage(
                          { type: "SET_FILTER", topicId: activeTopic, typeFilter: typeFilter === "all" ? null : typeFilter },
                          "*"
                        );
                      }}
                      style={{
                        width:        "100%",
                        padding:      "7px 10px",
                        background:   selectedEvt?.id === evt.id ? `${evt.color}12` : "transparent",
                        border:       "none",
                        borderBottom: "1px solid #0A0C0E",
                        cursor:       "pointer",
                        textAlign:    "left",
                        display:      "flex",
                        alignItems:   "flex-start",
                        gap:          7,
                        transition:   "background 150ms ease",
                      }}
                      onMouseOver={(e) => {
                        if (selectedEvt?.id !== evt.id)
                          e.currentTarget.style.background = "#111418";
                      }}
                      onMouseOut={(e) => {
                        if (selectedEvt?.id !== evt.id)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          width:        6,
                          height:       6,
                          borderRadius: "50%",
                          background:   evt.color,
                          flexShrink:   0,
                          marginTop:    3,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 11, color: "#E2E8F0", lineHeight: 1.4 }}>
                          {evt.title}
                        </div>
                        <div style={{ fontSize: 9, color: "#4A5568", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                          {evt.date}
                        </div>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
