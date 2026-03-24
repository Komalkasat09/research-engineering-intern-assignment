"use client";

import Shell from "@/components/Shell";

const rows = [
  {
    area: "Stance detection",
    limitation: "Zero-shot NLI marks most informal posts as ambiguous.",
    mitigation: "Expose ambiguity as a finding and pair with blind-spot examples + subreddit priors.",
  },
  {
    area: "Coordination",
    limitation: "Temporal+URL synchrony can include non-malicious cross-post behavior.",
    mitigation: "Show confidence labels, normalization mode, and explicit innocent explanations.",
  },
  {
    area: "Trend ranking",
    limitation: "Viral score can overweight one-off posts.",
    mitigation: "Show score + velocity + spread + post_count rationale side by side.",
  },
  {
    area: "Origin inference",
    limitation: "First observed subreddit may differ from true narrative birthplace.",
    mitigation: "Report confidence and time-to-mainstream with explicit uncertainty tier.",
  },
];

export default function BenchmarkPage() {
  return (
    <Shell>
      <div className="page-header">
        <span className="page-header__title">Benchmark</span>
        <span className="page-header__meta">model limits · safeguards · evaluation protocol</span>
      </div>

      <div style={{ padding: "14px 24px 24px", overflowY: "auto", flex: 1, minHeight: 0 }}>
        <div className="viz-panel" style={{ marginBottom: 12 }}>
          <div className="viz-panel__header">
            <span className="viz-panel__title">Why this benchmark exists</span>
          </div>
          <div style={{ padding: 14, fontSize: 13, color: "var(--text-soft)", lineHeight: 1.75 }}>
            Signal treats evaluation as falsification, not aesthetics. This page records where models fail, how failures appear in outputs,
            and what safeguards are applied so analyst decisions remain transparent and auditable.
          </div>
        </div>

        <div className="viz-panel">
          <div className="viz-panel__header">
            <span className="viz-panel__title">Failure modes and mitigations</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--dim)", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Area</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Known limitation</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Current mitigation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.area} style={{ borderBottom: "1px solid #0A0C0E" }}>
                    <td style={{ padding: "8px 12px", color: "var(--text)", fontFamily: "var(--font-mono)" }}>{r.area}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text-soft)" }}>{r.limitation}</td>
                    <td style={{ padding: "8px 12px", color: "var(--teal)" }}>{r.mitigation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
