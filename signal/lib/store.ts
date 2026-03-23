// FILE: lib/store.ts
"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DatasetMeta } from "@/types";

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
  meta:           DatasetMeta | null;
  setMeta:        (meta: DatasetMeta) => void;
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
      meta:           null,
      setMeta:        (meta) => set({ meta }),
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
      }),
    }
  )
);