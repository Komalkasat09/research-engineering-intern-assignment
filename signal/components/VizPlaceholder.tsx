"use client";

interface VizPlaceholderProps {
  title:  string;
  height?: number;
  label?: string;
}

/**
 * Used while the heavy viz components (Pixi canvas, D3 charts) are loading.
 * Shows a shimmer skeleton with a label so the layout doesn't collapse.
 */
export default function VizPlaceholder({
  title,
  height = 320,
  label,
}: VizPlaceholderProps) {
  return (
    <div className="viz-panel">
      <div className="viz-panel__header">
        <span className="viz-panel__title">{title}</span>
        {label && (
          <span
            style={{
              fontSize: 10,
              color: "var(--dim)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {label}
          </span>
        )}
      </div>
      <div
        className="viz-panel__body shimmer"
        style={{ height, minHeight: height }}
      />
    </div>
  );
}