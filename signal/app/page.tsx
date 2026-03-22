// // FILE: app/page.tsx
// "use client";

// /**
//  * Landing page — shown at "/" before the user enters the platform.
//  * A minimal hero with the platform name, tagline, and "Enter" CTA.
//  * Inspired by intelligence/newsroom aesthetics, NOT startup SaaS.
//  */

// import { useRouter } from "next/navigation";
// import { useEffect, useState } from "react";

// const TAGLINE_WORDS = [
//   "Political narratives.",
//   "Coordinated amplification.",
//   "Influence networks.",
//   "Discourse drift.",
// ];

// export default function LandingPage() {
//   const router = useRouter();
//   const [wordIdx, setWordIdx] = useState(0);
//   const [visible, setVisible] = useState(true);

//   useEffect(() => {
//     const interval = setInterval(() => {
//       setVisible(false);
//       setTimeout(() => {
//         setWordIdx((i) => (i + 1) % TAGLINE_WORDS.length);
//         setVisible(true);
//       }, 300);
//     }, 2200);
//     return () => clearInterval(interval);
//   }, []);

//   return (
//     <div
//       style={{
//         minHeight:      "100vh",
//         background:     "#0A0C0E",
//         display:        "flex",
//         flexDirection:  "column",
//         alignItems:     "center",
//         justifyContent: "center",
//         padding:        "40px 24px",
//         position:       "relative",
//         overflow:       "hidden",
//       }}
//     >
//       {/* Grid background */}
//       <div
//         style={{
//           position:   "absolute",
//           inset:      0,
//           backgroundImage: `
//             linear-gradient(rgba(29,158,117,0.04) 1px, transparent 1px),
//             linear-gradient(90deg, rgba(29,158,117,0.04) 1px, transparent 1px)
//           `,
//           backgroundSize: "48px 48px",
//           pointerEvents: "none",
//         }}
//       />

//       {/* Corner classification label */}
//       <div
//         style={{
//           position:   "absolute",
//           top:        20,
//           left:       24,
//           fontSize:   10,
//           color:      "#2A3340",
//           fontFamily: "var(--font-geist-mono, monospace)",
//           letterSpacing: "0.1em",
//           textTransform: "uppercase",
//         }}
//       >
//         research platform · v1.0 · simppl
//       </div>

//       <div
//         style={{
//           position:   "absolute",
//           top:        20,
//           right:      24,
//           fontSize:   10,
//           color:      "#2A3340",
//           fontFamily: "var(--font-geist-mono, monospace)",
//           letterSpacing: "0.1em",
//         }}
//       >
//         political discourse · narrative tracker
//       </div>

//       {/* Main content */}
//       <div style={{ textAlign: "center", maxWidth: 640, position: "relative", zIndex: 1 }}>

//         {/* Live indicator */}
//         <div
//           style={{
//             display:        "inline-flex",
//             alignItems:     "center",
//             gap:            6,
//             marginBottom:   32,
//             padding:        "4px 12px",
//             border:         "1px solid rgba(29,158,117,0.3)",
//             borderRadius:   20,
//             background:     "rgba(29,158,117,0.06)",
//           }}
//         >
//           <div
//             style={{
//               width:        5,
//               height:       5,
//               borderRadius: "50%",
//               background:   "#1D9E75",
//               animation:    "livePulse 2s ease-in-out infinite",
//             }}
//           />
//           <span style={{ fontSize: 10, color: "#1D9E75", fontFamily: "var(--font-geist-mono, monospace)", letterSpacing: "0.06em" }}>
//             847,203 posts indexed
//           </span>
//         </div>

//         {/* Wordmark */}
//         <h1
//           style={{
//             fontSize:      72,
//             fontWeight:    500,
//             letterSpacing: "-0.05em",
//             color:         "#E2E8F0",
//             lineHeight:    1,
//             marginBottom:  16,
//             fontFamily:    "var(--font-geist-sans, sans-serif)",
//           }}
//         >
//           signal
//           <span style={{ color: "#1D9E75" }}>.</span>
//         </h1>

//         {/* Rotating tagline */}
//         <div style={{ height: 28, marginBottom: 24 }}>
//           <p
//             style={{
//               fontSize:    18,
//               color:       "#4A5568",
//               fontFamily:  "var(--font-geist-mono, monospace)",
//               transition:  "opacity 0.3s ease",
//               opacity:     visible ? 1 : 0,
//               margin:      0,
//             }}
//           >
//             {TAGLINE_WORDS[wordIdx]}
//           </p>
//         </div>

//         {/* Description */}
//         <p
//           style={{
//             fontSize:   14,
//             color:      "#3A4148",
//             lineHeight: 1.8,
//             maxWidth:   480,
//             margin:     "0 auto 40px",
//             fontFamily: "var(--font-geist-sans, sans-serif)",
//           }}
//         >
//           A narrative intelligence platform for political discourse on Reddit,
//           tracing how narratives emerge, spread, and evolve across communities.
//           Built for SimPPL research.
//         </p>

//         {/* CTA buttons */}
//         <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
//           <button
//             onClick={() => router.push("/map")}
//             style={{
//               padding:      "12px 28px",
//               background:   "rgba(29,158,117,0.15)",
//               border:       "1px solid #0F6E56",
//               borderRadius: 8,
//               color:        "#1D9E75",
//               fontSize:     14,
//               fontFamily:   "var(--font-geist-sans, sans-serif)",
//               cursor:       "pointer",
//               letterSpacing: "-0.01em",
//               transition:   "all 150ms ease",
//             }}
//             onMouseOver={(e) => {
//               e.currentTarget.style.background = "rgba(29,158,117,0.25)";
//             }}
//             onMouseOut={(e) => {
//               e.currentTarget.style.background = "rgba(29,158,117,0.15)";
//             }}
//           >
//             explore narrative map →
//           </button>

//           <button
//             onClick={() => router.push("/chat")}
//             style={{
//               padding:      "12px 28px",
//               background:   "transparent",
//               border:       "1px solid #1E2530",
//               borderRadius: 8,
//               color:        "#8A9BB0",
//               fontSize:     14,
//               fontFamily:   "var(--font-geist-sans, sans-serif)",
//               cursor:       "pointer",
//               transition:   "all 150ms ease",
//             }}
//             onMouseOver={(e) => {
//               e.currentTarget.style.borderColor = "#2A3340";
//               e.currentTarget.style.color       = "#A0AEC0";
//             }}
//             onMouseOut={(e) => {
//               e.currentTarget.style.borderColor = "#1E2530";
//               e.currentTarget.style.color       = "#8A9BB0";
//             }}
//           >
//             ask Signal
//           </button>
//         </div>

//         {/* Feature pills */}
//         <div
//           style={{
//             display:        "flex",
//             gap:            8,
//             justifyContent: "center",
//             flexWrap:       "wrap",
//             marginTop:      40,
//           }}
//         >
//           {[
//             "UMAP semantic map",
//             "BERTopic clusters",
//             "Narrative velocity",
//             "Event stitching",
//             "Force-directed network",
//             "Stance river",
//             "Coordinated behavior",
//             "Narrative fingerprint",
//             "OSINT chatbot",
//           ].map((f) => (
//             <span
//               key={f}
//               style={{
//                 padding:      "3px 10px",
//                 border:       "1px solid #1E2530",
//                 borderRadius: 20,
//                 fontSize:     11,
//                 color:        "#3A4148",
//                 fontFamily:   "var(--font-geist-mono, monospace)",
//               }}
//             >
//               {f}
//             </span>
//           ))}
//         </div>
//       </div>

//       {/* Bottom attribution */}
//       <div
//         style={{
//           position:   "absolute",
//           bottom:     20,
//           fontSize:   10,
//           color:      "#2A3340",
//           fontFamily: "var(--font-geist-mono, monospace)",
//           textAlign:  "center",
//         }}
//       >
//         powered by Gemini 2.0 Flash · SBERT · BERTopic · D3 · Pixi.js
//       </div>

//       <style>{`
//         @keyframes livePulse {
//           0%, 100% { opacity: 1; transform: scale(1); }
//           50%       { opacity: 0.4; transform: scale(0.7); }
//         }
//       `}</style>
//     </div>
//   );
// }
// # Replace app/page.tsx with this complete file

// Replace the entire contents of app/page.tsx with the following code.
// Do not modify anything else.

// ```tsx
// // FILE: app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CLUSTERS = [
  { name: "electoral politics",  color: "#1D9E75", bg: "rgba(29,158,117,0.10)",  border: "#0F3A26" },
  { name: "anarchist / socialist", color: "#7F77DD", bg: "rgba(127,119,221,0.10)", border: "#2A2560" },
  { name: "Musk / DOGE",         color: "#D85A30", bg: "rgba(216,90,48,0.10)",   border: "#3A1A0A" },
  { name: "Ukraine / Russia",    color: "#BA7517", bg: "rgba(186,117,23,0.10)",  border: "#3A2A0A" },
  { name: "tariffs / trade",     color: "#378ADD", bg: "rgba(55,138,221,0.10)",  border: "#0A2040" },
  { name: "immigration / ICE",   color: "#D4537E", bg: "rgba(212,83,126,0.10)", border: "#3A1530" },
  { name: "federal workers",     color: "#639922", bg: "rgba(99,153,34,0.10)",   border: "#1A2F0A" },
];

const FEATURES = [
  { name: "Narrative map",       color: "#1D9E75", desc: "UMAP semantic space · 8 clusters · WebGL 60fps" },
  { name: "Velocity timeline",   color: "#7F77DD", desc: "Cosine drift per week · event stitching" },
  { name: "Spread graph",        color: "#BA7517", desc: "PageRank influence · Louvain communities" },
  { name: "3D Globe",            color: "#378ADD", desc: "Geospatial event intelligence · 28 events" },
  { name: "Stance river",        color: "#D4537E", desc: "Progressive / neutral / conservative over time" },
  { name: "Coord. behavior",     color: "#D85A30", desc: "Synchronized posting · real signal detected" },
  { name: "Narrative fingerprint", color: "#639922", desc: "5-community AI reaction simulation" },
  { name: "Ask Signal",          color: "#5DCAA5", desc: "OSINT chatbot · Groq · LLaMA 3.3 70B + RAG" },
];

export default function LandingPage() {
  const router = useRouter();
  const [hoveredCluster, setHoveredCluster] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // Animate activity bars
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1800);
    return () => clearInterval(t);
  }, []);

  const barHeights = [28, 14, 38, 22, 44, 18, 32, 26, 40, 16, 34, 20, 36, 24, 42, 30, 16, 38, 22, 44, 18];

  return (
    <div
      style={{
        minHeight:      "100vh",
        background:     "#070A0D",
        display:        "flex",
        flexDirection:  "column",
        position:       "relative",
        overflow:       "hidden",
        fontFamily:     "var(--font-geist-mono, ui-monospace, monospace)",
      }}
    >
      {/* Grid background */}
      <div
        style={{
          position:   "absolute",
          inset:      0,
          backgroundImage: `
            linear-gradient(rgba(13,26,34,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(13,26,34,0.8) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />

      {/* Corner labels */}
      <div style={{ position:"absolute", top:16, left:20, fontSize:9, color:"#1A2A35", letterSpacing:".1em" }}>
        SIGNAL · NARRATIVE INTELLIGENCE · v1.0
      </div>
      <div style={{ position:"absolute", top:16, right:20, fontSize:9, color:"#1A2A35", letterSpacing:".1em" }}>
        SIMPPL RESEARCH
      </div>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "72px 32px 44px",
          textAlign:      "center",
          position:       "relative",
          zIndex:         2,
        }}
      >
        {/* Live badge */}
        <div
          style={{
            display:      "inline-flex",
            alignItems:   "center",
            gap:          6,
            padding:      "4px 14px",
            border:       "1px solid #0F3A26",
            borderRadius: 20,
            background:   "rgba(29,158,117,0.06)",
            fontSize:     10,
            color:        "#1D9E75",
            letterSpacing: ".06em",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width:        5,
              height:       5,
              borderRadius: "50%",
              background:   "#1D9E75",
              animation:    "blink 2s ease-in-out infinite",
              flexShrink:   0,
            }}
          />
          9,203 posts indexed · live
        </div>

        {/* Wordmark */}
        <h1
          style={{
            fontSize:      88,
            fontWeight:    400,
            letterSpacing: "-.06em",
            color:         "#E2E8F0",
            lineHeight:    1,
            marginBottom:  6,
            fontFamily:    "var(--font-geist-mono, ui-monospace, monospace)",
          }}
        >
          signal
          <span style={{ color: "#1D9E75" }}>.</span>
        </h1>

        <div
          style={{
            fontSize:      11,
            color:         "#2A4A5A",
            letterSpacing: ".16em",
            marginBottom:  28,
          }}
        >
          POLITICAL NARRATIVE INTELLIGENCE
        </div>

        <p
          style={{
            fontSize:   15,
            color:      "#4A6A7A",
            lineHeight: 1.75,
            maxWidth:   500,
            marginBottom: 40,
            fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)",
            fontWeight: 400,
          }}
        >
          Trace how political narratives emerge, mutate, and spread
          across partisan communities. From Musk/DOGE to immigration
          policy — see the discourse in motion.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
          <button
            onClick={() => router.push("/map")}
            style={{
              padding:      "12px 26px",
              background:   "rgba(29,158,117,0.15)",
              border:       "1px solid #0F6E56",
              borderRadius: 8,
              color:        "#1D9E75",
              fontSize:     13,
              cursor:       "pointer",
              fontFamily:   "var(--font-geist-mono, ui-monospace, monospace)",
              transition:   "all 150ms ease",
              letterSpacing: ".02em",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(29,158,117,0.28)"; }}
            onMouseOut ={(e) => { e.currentTarget.style.background = "rgba(29,158,117,0.15)"; }}
          >
            explore narrative map →
          </button>
          <button
            onClick={() => router.push("/chat")}
            style={{
              padding:      "12px 26px",
              background:   "transparent",
              border:       "1px solid #1A2A35",
              borderRadius: 8,
              color:        "#4A6A7A",
              fontSize:     13,
              cursor:       "pointer",
              fontFamily:   "var(--font-geist-mono, ui-monospace, monospace)",
              transition:   "all 150ms ease",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#2A3A45"; e.currentTarget.style.color = "#8A9BB0"; }}
            onMouseOut ={(e) => { e.currentTarget.style.borderColor = "#1A2A35"; e.currentTarget.style.color = "#4A6A7A"; }}
          >
            ask Signal
          </button>
          <button
            onClick={() => router.push("/fingerprint")}
            style={{
              padding:      "12px 26px",
              background:   "transparent",
              border:       "1px solid #1A2A35",
              borderRadius: 8,
              color:        "#4A6A7A",
              fontSize:     13,
              cursor:       "pointer",
              fontFamily:   "var(--font-geist-mono, ui-monospace, monospace)",
              transition:   "all 150ms ease",
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "#2A3A45"; e.currentTarget.style.color = "#8A9BB0"; }}
            onMouseOut ={(e) => { e.currentTarget.style.borderColor = "#1A2A35"; e.currentTarget.style.color = "#4A6A7A"; }}
          >
            narrative fingerprint
          </button>
        </div>
      </div>

      {/* ── Live clusters ───────────────────────────────────────────── */}
      <div style={{ padding: "0 32px", position: "relative", zIndex: 2 }}>
        <div
          style={{
            fontSize:      9,
            color:         "#1E2E3A",
            letterSpacing: ".14em",
            textAlign:     "center",
            marginBottom:  18,
          }}
        >
          LIVE NARRATIVE CLUSTERS — FROM YOUR DATASET
        </div>

        <div
          style={{
            display:        "flex",
            gap:            8,
            flexWrap:       "wrap",
            justifyContent: "center",
            marginBottom:   36,
          }}
        >
          {CLUSTERS.map((c, i) => (
            <div
              key={c.name}
              onClick={() => router.push("/map")}
              onMouseOver={() => setHoveredCluster(i)}
              onMouseOut ={() => setHoveredCluster(null)}
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          7,
                padding:      "6px 13px",
                borderRadius: 20,
                border:       `1px solid ${hoveredCluster === i ? c.color + "55" : c.border}`,
                background:   hoveredCluster === i ? c.color + "22" : c.bg,
                color:        c.color,
                fontSize:     12,
                cursor:       "pointer",
                transition:   "all 200ms ease",
                fontFamily:   "var(--font-geist-mono, ui-monospace, monospace)",
                userSelect:   "none",
              }}
            >
              <div
                style={{
                  width:        6,
                  height:       6,
                  borderRadius: "50%",
                  background:   c.color,
                  flexShrink:   0,
                  opacity:      hoveredCluster === i ? 1 : 0.7,
                }}
              />
              {c.name}
            </div>
          ))}
        </div>

        {/* Activity sparkline */}
        <div
          style={{
            display:        "flex",
            gap:            3,
            justifyContent: "center",
            alignItems:     "flex-end",
            height:         52,
            marginBottom:   36,
          }}
        >
          {barHeights.map((h, i) => {
            const animH = Math.max(6, (h + Math.sin((tick + i) * 0.7) * 8));
            const clusterIdx = i % CLUSTERS.length;
            return (
              <div
                key={i}
                style={{
                  width:        7,
                  height:       `${animH}px`,
                  borderRadius: "2px 2px 0 0",
                  background:   CLUSTERS[clusterIdx].color,
                  opacity:      0.45,
                  transition:   "height 1.8s ease",
                  flexShrink:   0,
                }}
              />
            );
          })}
        </div>

        {/* Stats row */}
        <div
          style={{
            display:       "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap:           1,
            background:    "#0D1A22",
            border:        "1px solid #0D1A22",
            borderRadius:  10,
            overflow:      "hidden",
            maxWidth:      720,
            margin:        "0 auto 40px",
          }}
        >
          {[
            { label: "POSTS INDEXED",   val: "9,203",   sub: "Jul 2024 – Feb 2025",      subColor: "#1D9E75" },
            { label: "CLUSTERS",        val: "8",       sub: "BERTopic · HDBSCAN",        subColor: "#7F77DD" },
            { label: "FLAGGED PAIRS",   val: "1",       sub: "coord. behavior detected",  subColor: "#D85A30" },
            { label: "SUBREDDITS",      val: "5+",      sub: "r/politics, r/Anarchism…", subColor: "#8A9BB0" },
          ].map((s) => (
            <div
              key={s.label}
              style={{ background: "#070A0D", padding: "16px 18px" }}
            >
              <div style={{ fontSize: 9, color: "#1E2E3A", letterSpacing: ".1em", marginBottom: 6 }}>
                {s.label}
              </div>
              <div
                style={{
                  fontSize:   22,
                  fontWeight: 400,
                  color:      "#E2E8F0",
                  letterSpacing: "-.02em",
                  marginBottom: 4,
                }}
              >
                {s.val}
              </div>
              <div style={{ fontSize: 10, color: s.subColor }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Feature grid */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap:                 8,
            maxWidth:            720,
            margin:              "0 auto 60px",
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.name}
              onClick={() => router.push("/map")}
              style={{
                background:   "#0A1018",
                border:       "1px solid #0D1A22",
                borderRadius: 8,
                padding:      "14px",
                cursor:       "pointer",
                transition:   "border-color 200ms ease",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = f.color + "44";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "#0D1A22";
              }}
            >
              <div
                style={{
                  width:        8,
                  height:       8,
                  borderRadius: "50%",
                  background:   f.color,
                  marginBottom: 10,
                }}
              />
              <div
                style={{
                  fontSize:   12,
                  color:      "#8A9BB0",
                  marginBottom: 5,
                  fontWeight: 500,
                  fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)",
                }}
              >
                {f.name}
              </div>
              <div
                style={{
                  fontSize:   10,
                  color:      "#2A3A45",
                  lineHeight: 1.5,
                  fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)",
                }}
              >
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom attribution */}
      <div
        style={{
          textAlign:  "center",
          paddingBottom: 24,
          fontSize:   9,
          color:      "#1A2A35",
          letterSpacing: ".1em",
          position:   "relative",
          zIndex:     2,
        }}
      >
        GROQ · LLAMA 3.3 70B · SBERT · BERTOPIC · D3 · PIXI.JS · THREE.JS · NEXT.JS 14
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
