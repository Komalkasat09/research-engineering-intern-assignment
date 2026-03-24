// FILE: lib/constants.ts
export const TOPIC_COLORS: Record<number, string> = {
  0:  "#1D9E75", 1: "#7F77DD", 2: "#BA7517", 3: "#D85A30",
  4:  "#888780", 5: "#D4537E", 6: "#378ADD", 7: "#639922",
  8:  "#E24B4A", 9: "#5DCAA5", [-1]: "#3A4148",
};

export const STANCE_COLORS = {
  pro: "#1D9E75", neutral: "#3A4148", con: "#D85A30",
} as const;

export const NAV_ITEMS = [
  {
    section: "Explore",
    items: [
      { href: "/map",         label: "Narrative map",         dot: "teal",   description: "UMAP semantic space" },
      { href: "/timeline",    label: "Timeline",              dot: "teal",   description: "Velocity + events" },
      { href: "/graph",       label: "Spread graph",          dot: "teal",   description: "Account network" },
      { href: "/origins",     label: "Narrative origins",     dot: "purple", description: "Who said it first" },
      { href: "/trends",      label: "Trends",                dot: "coral",  description: "Rising narratives" },
      { href: "/globe",       label: "Globe",                 dot: "teal",   description: "Geospatial events" },
    ],
  },
  {
    section: "Analysis",
    items: [
      { href: "/stance",      label: "Stance river",          dot: "amber",  description: "Pro/con over time" },
      { href: "/signals",     label: "Coord. behavior",       dot: "purple", description: "Synchronized posting" },
      { href: "/fingerprint", label: "Narrative fingerprint", dot: "coral",  description: "Multi-community sim" },
    ],
  },
  {
    section: "Investigate",
    items: [
      { href: "/chat",        label: "Ask Signal",            dot: "coral",  description: "OSINT chatbot" },
      { href: "/benchmark",   label: "Benchmark",             dot: "amber",  description: "Model limits and eval" },
    ],
  },
] as const;

export const DATE_RANGE = { start: "2019-01-01", end: "2023-12-31" } as const;

export const PINNED_EVENTS = [
  { date: "2019-09-23", title: "UN Climate Summit 2019",    color: "#1D9E75" },
  { date: "2021-11-13", title: "COP26 Glasgow",             color: "#1D9E75" },
  { date: "2022-02-28", title: "IPCC AR6 Working Group II", color: "#7F77DD" },
  { date: "2022-11-06", title: "COP27 Sharm el-Sheikh",     color: "#1D9E75" },
  { date: "2023-03-20", title: "IPCC Synthesis Report",     color: "#7F77DD" },
  { date: "2023-11-30", title: "COP28 Dubai",               color: "#1D9E75" },
] as const;