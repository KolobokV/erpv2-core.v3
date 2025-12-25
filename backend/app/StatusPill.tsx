import React from "react";

export type StatusPillTone = "neutral" | "success" | "warning" | "danger" | "info";

export type StatusPillProps = {
  label: string;
  tone?: StatusPillTone;
  className?: string;
};

function toneToClasses(tone: StatusPillTone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "warning":
      return "bg-amber-50 border-amber-200 text-amber-700";
    case "danger":
      return "bg-red-50 border-red-200 text-red-700";
    case "info":
      return "bg-sky-50 border-sky-200 text-sky-700";
    case "neutral":
    default:
      return "bg-slate-50 border-slate-200 text-slate-700";
  }
}

const StatusPill: React.FC<StatusPillProps> = ({ label, tone = "neutral", className }) => {
  const classes =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
    toneToClasses(tone) +
    (className ? " " + className : "");
  return <span className={classes}>{label}</span>;
};

export default StatusPill;
