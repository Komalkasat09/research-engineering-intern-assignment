// FILE: lib/store.ts
"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DatasetMeta, InjectedPost } from "@/types";

export type TimeRangePreset = "Jul 2024" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec 2024" | "Jan 2025" | "All";
export type PlatformFilter = "reddit" | "twitter";

export interface InvestigationContext {
  source: "trends" | "graph" | "origins" | "signals" | "manual";
  topicId: number | null;
  narrativeName?: string;
  originSubreddit?: string;
  topPostAuthor?: string;
  topPostScore?: number;
  note?: string;
  createdAt: number;
}

export interface MonitorQuery {
  id: string;
  query: string;
  topicFilter: number | null;
  createdAt: number;
}

export interface MonitorAlertPost {
  post_id: string;
  title: string;
  cluster_label: string;
  score: number;
}

export interface MonitorAlert {
  id: string;
  query: string;
  newPostCount: number;
  topCluster: string;
  detectedAt: number;
  posts: MonitorAlertPost[];
  dismissed: boolean;
}

interface SignalStore {
  activeTopic:    number | null;
  setActiveTopic: (id: number | null) => void;
  activeRange:    TimeRangePreset;
  setActiveRange: (range: TimeRangePreset) => void;
  dateStart:      number;
  dateEnd:        number;
  setDateRange:   (start: number, end: number) => void;
  platforms:      PlatformFilter[];
  togglePlatform: (platform: PlatformFilter) => void;
  setPlatforms:   (platforms: PlatformFilter[]) => void;
  hoveredPost:    string | null;
  setHoveredPost: (id: string | null) => void;
  selectedNode:   string | null;
  setSelectedNode:(id: string | null) => void;
  investigationContext: InvestigationContext | null;
  setInvestigationContext: (context: InvestigationContext | null) => void;
  clearInvestigationContext: () => void;
  analystRailOpen: boolean;
  setAnalystRailOpen: (open: boolean) => void;
  toggleAnalystRail: () => void;
  opsTheme: boolean;
  setOpsTheme: (enabled: boolean) => void;
  toggleOpsTheme: () => void;
  meta:           DatasetMeta | null;
  setMeta:        (meta: DatasetMeta) => void;
  liveFeedResults: InjectedPost[] | null;
  setLiveFeedResults: (posts: InjectedPost[] | null) => void;
  showLiveLayer:   boolean;
  setShowLiveLayer: (show: boolean) => void;
  toggleShowLiveLayer: () => void;
  visibleClusterIds: number[] | null;
  setVisibleClusterIds: (ids: number[] | null) => void;
  savedMonitorQueries: MonitorQuery[];
  addMonitorQuery: (query: string, topicFilter: number | null) => void;
  removeMonitorQuery: (id: string) => void;
  monitorActive: boolean;
  setMonitorActive: (active: boolean) => void;
  monitorIntervalMinutes: number;
  setMonitorIntervalMinutes: (n: number) => void;
  monitorAlerts: MonitorAlert[];
  addMonitorAlert: (alert: Omit<MonitorAlert, "id" | "dismissed">) => void;
  dismissMonitorAlert: (id: string) => void;
  clearMonitorAlerts: () => void;
  monitorLastRun: Record<string, number>;
  setMonitorLastRun: (queryId: string, ts: number) => void;
}

export const useSignalStore = create<SignalStore>()(
  persist(
    (set) => ({
      activeTopic:    null,
      setActiveTopic: (id) => set({ activeTopic: id }),
      activeRange:    "All",
      setActiveRange: (range) => set({ activeRange: range }),
      dateStart:      new Date("2024-07-01").getTime() / 1000,
      dateEnd:        new Date("2025-02-28").getTime() / 1000,
      setDateRange:   (start, end) => set({ dateStart: start, dateEnd: end }),
      platforms:      ["reddit", "twitter"],
      togglePlatform: (platform) => set((state) => {
        const hasPlatform = state.platforms.includes(platform);
        if (hasPlatform && state.platforms.length === 1) return state;
        return {
          platforms: hasPlatform
            ? state.platforms.filter((p) => p !== platform)
            : [...state.platforms, platform],
        };
      }),
      setPlatforms: (platforms) => set({ platforms: platforms.length ? platforms : ["reddit"] }),
      hoveredPost:    null,
      setHoveredPost: (id) => set({ hoveredPost: id }),
      selectedNode:   null,
      setSelectedNode:(id) => set({ selectedNode: id }),
      investigationContext: null,
      setInvestigationContext: (context) => set({ investigationContext: context }),
      clearInvestigationContext: () => set({ investigationContext: null }),
      analystRailOpen: true,
      setAnalystRailOpen: (open) => set({ analystRailOpen: open }),
      toggleAnalystRail: () => set((state) => ({ analystRailOpen: !state.analystRailOpen })),
      opsTheme: false,
      setOpsTheme: (enabled) => set({ opsTheme: enabled }),
      toggleOpsTheme: () => set((state) => ({ opsTheme: !state.opsTheme })),
      meta:           null,
      setMeta:        (meta) => set({ meta }),
      liveFeedResults: null,
      setLiveFeedResults: (posts) => set({ liveFeedResults: posts }),
      showLiveLayer: false,
      setShowLiveLayer: (show) => set({ showLiveLayer: show }),
      toggleShowLiveLayer: () => set((state) => ({ showLiveLayer: !state.showLiveLayer })),
      visibleClusterIds: null,
      setVisibleClusterIds: (ids) => set({ visibleClusterIds: ids }),
      savedMonitorQueries: [],
      addMonitorQuery: (query, topicFilter) => set((state) => ({
        savedMonitorQueries: [...state.savedMonitorQueries, {
          id: crypto.randomUUID(),
          query,
          topicFilter,
          createdAt: Date.now(),
        }],
      })),
      removeMonitorQuery: (id) => set((state) => ({
        savedMonitorQueries: state.savedMonitorQueries.filter((item) => item.id !== id),
      })),
      monitorActive: false,
      setMonitorActive: (active) => set({ monitorActive: active }),
      monitorIntervalMinutes: 5,
      setMonitorIntervalMinutes: (n) => set({ monitorIntervalMinutes: n }),
      monitorAlerts: [],
      addMonitorAlert: (alert) => set((state) => ({
        monitorAlerts: [{
          ...alert,
          id: crypto.randomUUID(),
          dismissed: false,
        }, ...state.monitorAlerts].slice(0, 20),
      })),
      dismissMonitorAlert: (id) => set((state) => ({
        monitorAlerts: state.monitorAlerts.map((alert) =>
          alert.id === id ? { ...alert, dismissed: true } : alert
        ),
      })),
      clearMonitorAlerts: () => set({ monitorAlerts: [] }),
      monitorLastRun: {},
      setMonitorLastRun: (queryId, ts) => set((state) => ({
        monitorLastRun: { ...state.monitorLastRun, [queryId]: ts },
      })),
    }),
    {
      name: "signal-store-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeTopic: state.activeTopic,
        activeRange: state.activeRange,
        dateStart: state.dateStart,
        dateEnd: state.dateEnd,
        platforms: state.platforms,
        selectedNode: state.selectedNode,
        investigationContext: state.investigationContext,
        analystRailOpen: state.analystRailOpen,
        opsTheme: state.opsTheme,
        showLiveLayer: state.showLiveLayer,
        savedMonitorQueries: state.savedMonitorQueries,
        monitorAlerts: state.monitorAlerts,
      }),
    }
  )
);