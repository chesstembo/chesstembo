import React from "react";

interface ProgressBarProps {
  progress?: number;
  solvedCount?: number;
  total?: number;
}

export default function ProgressBar({ progress = 0, solvedCount = 0, total = 0 }: ProgressBarProps) {
  // Use provided progress or calculate from solvedCount/total
  const calculatedProgress = total > 0 ? (solvedCount / total) * 100 : progress;
  const pct = Math.max(0, Math.min(100, calculatedProgress));

  return (
    <div style={{ width: "80%", margin: "1rem auto" }}>
      <div
        style={{
          background: "#eee",
          height: 10,
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#4caf50",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <p style={{ fontSize: "0.9rem" }}>
        {solvedCount > 0 && total > 0 ? `${solvedCount}/${total} (${pct.toFixed(0)}%)` : `${pct.toFixed(0)}% complete`}
      </p>
    </div>
  );
}