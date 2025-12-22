export type StatusKind = "overdue" | "today" | "soon" | "calm" | "done" | "unknown";

export const STATUS_STYLE: Record<StatusKind, {
  bg: string;
  border: string;
  color: string;
  weight?: number;
}> = {
  overdue: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", color: "rgba(185,28,28,1)", weight: 900 },
  today:   { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.35)", color: "rgba(180,83,9,1)", weight: 800 },
  soon:    { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.28)", color: "rgba(30,64,175,1)", weight: 700 },
  calm:    { bg: "rgba(15,23,42,0.04)", border: "rgba(15,23,42,0.18)", color: "rgba(15,23,42,0.85)", weight: 600 },
  done:    { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", color: "rgba(5,150,105,1)", weight: 600 },
  unknown: { bg: "rgba(15,23,42,0.03)", border: "rgba(15,23,42,0.12)", color: "rgba(15,23,42,0.75)", weight: 600 },
};
