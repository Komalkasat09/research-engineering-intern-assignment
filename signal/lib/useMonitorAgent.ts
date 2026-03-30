"use client";

import { useEffect } from "react";
import { useSignalStore } from "@/lib/store";

export function useMonitorAgent() {
  const store = useSignalStore();

  useEffect(() => {
    if (!store.monitorActive) return;
    if (!store.savedMonitorQueries.length) return;

    async function runCycle() {
      const now = Date.now();
      const intervalMs = store.monitorIntervalMinutes * 60 * 1000;

      for (const savedQuery of store.savedMonitorQueries) {
        const lastRun = store.monitorLastRun[savedQuery.id] ?? 0;
        if (now - lastRun < intervalMs) continue;

        try {
          const res = await fetch("/api/live/inject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: savedQuery.query,
              topic_filter: savedQuery.topicFilter ?? undefined,
            }),
          });
          if (!res.ok) continue;

          const data = await res.json();
          const posts = (data.posts ?? []) as Array<{
            post_id: string;
            title: string;
            cluster_label: string;
            cluster_id: number;
            score: number;
          }>;

          // Only alert if there are NEW posts since last run.
          // "New" = post not seen in previous run for this query.
          // Use a simple heuristic: if post count > 0 and
          // lastRun > 0 (not the very first run), fire alert.
          if (posts.length > 0 && lastRun > 0) {
            // Find most common cluster among new posts
            const clusterCounts = new Map<string, number>();
            for (const p of posts) {
              clusterCounts.set(
                p.cluster_label,
                (clusterCounts.get(p.cluster_label) ?? 0) + 1
              );
            }
            const topCluster = [...clusterCounts.entries()]
              .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

            store.addMonitorAlert({
              query: savedQuery.query,
              newPostCount: posts.length,
              topCluster,
              detectedAt: now,
              posts: posts.slice(0, 5).map((p) => ({
                post_id: p.post_id,
                title: p.title,
                cluster_label: p.cluster_label,
                score: p.score,
              })),
            });
          }

          store.setMonitorLastRun(savedQuery.id, now);
        } catch {
          // Silently skip failed queries — do not crash the loop
          continue;
        }
      }
    }

    // Run immediately on activation
    runCycle();

    // Then run on interval
    const interval = setInterval(
      runCycle,
      store.monitorIntervalMinutes * 60 * 1000
    );
    return () => clearInterval(interval);
  }, [
    store.monitorActive,
    store.savedMonitorQueries,
    store.monitorIntervalMinutes,
    store.monitorLastRun,
    store.setMonitorLastRun,
    store.addMonitorAlert,
  ]);
}
