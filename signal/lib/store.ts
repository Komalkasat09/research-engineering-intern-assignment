// FILE: lib/store.ts
"use client";
import { create } from "zustand";
import type { DatasetMeta } from "@/types";

interface SignalStore {
  activeTopic:    number | null;
  setActiveTopic: (id: number | null) => void;
  dateStart:      number;
  dateEnd:        number;
  setDateRange:   (start: number, end: number) => void;
  hoveredPost:    string | null;
  setHoveredPost: (id: string | null) => void;
  selectedNode:   string | null;
  setSelectedNode:(id: string | null) => void;
  meta:           DatasetMeta | null;
  setMeta:        (meta: DatasetMeta) => void;
}

export const useSignalStore = create<SignalStore>((set) => ({
  activeTopic:    null,
  setActiveTopic: (id) => set({ activeTopic: id }),
  dateStart:      new Date("2019-01-01").getTime() / 1000,
  dateEnd:        new Date("2023-12-31").getTime() / 1000,
  setDateRange:   (start, end) => set({ dateStart: start, dateEnd: end }),
  hoveredPost:    null,
  setHoveredPost: (id) => set({ hoveredPost: id }),
  selectedNode:   null,
  setSelectedNode:(id) => set({ selectedNode: id }),
  meta:           null,
  setMeta:        (meta) => set({ meta }),
}));