// FILE: components/StatRow.tsx
"use client";
import { fmtCount } from "@/lib/utils";

interface Stat { label: string; value: string | number; delta?: string; deltaColor?: string; mono?: boolean; }
interface Props { stats: Stat[]; }

export default function StatRow({ stats }: Props) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${stats.length},1fr)`, gap:10 }}>
      {stats.map((s) => (
        <div key={s.label} className="stat-card fade-up">
          <div className="stat-card__label" suppressHydrationWarning>{s.label}</div>
          <div className="stat-card__value" suppressHydrationWarning style={!s.mono ? { fontFamily:"var(--font-sans)", fontSize:20 } : {}}>
            {typeof s.value === "number" ? fmtCount(s.value) : s.value}
          </div>
          {s.delta && (
            <div className="stat-card__delta" suppressHydrationWarning style={s.deltaColor ? { color:s.deltaColor } : {}}>
              {s.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}