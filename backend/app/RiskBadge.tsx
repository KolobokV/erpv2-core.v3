import React from "react";

type RiskBadgeProps = {
  score: number;
  label?: string;
};

function pickColor(score: number): string {
  if (score >= 80) return "#ef4444"; // red
  if (score >= 50) return "#f59e0b"; // orange
  if (score >= 20) return "#eab308"; // yellow
  return "#22c55e"; // green
}

export function RiskBadge(props: RiskBadgeProps) {
  const { score, label } = props;
  const color = pickColor(Number.isFinite(score) ? score : 0);

  return (
    <div
      title={label || ""}
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: color,
        color: "#000",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap"
      }}
    >
      {label ? label : `Risk ${score}`}
    </div>
  );
}