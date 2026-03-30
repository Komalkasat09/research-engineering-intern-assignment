// FILE: components/StatRow.tsx
"use client";
import { fmtCount } from "@/lib/utils";
import { useBreakpoint } from "@/lib/useBreakpoint";

interface Stat { label: string; value: string | number; delta?: string; deltaColor?: string; mono?: boolean; }
interface Props { stats: Stat[]; }

export default function StatRow({ stats }: Props) {
  const { width } = useBreakpoint();
  const columns = width < 600 ? "1fr" : width < 900 ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: columns, gap: 8 }}>
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