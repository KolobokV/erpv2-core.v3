import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { loadMaterializedTasksV27 } from "../v27/profileStore";
import { deriveRisk } from "../v27/riskPriority";

type Props = {
  clientId: string;
  title?: string;
};

function pill(level: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    opacity: 0.95,
    whiteSpace: "nowrap",
  };

  if (level === "critical") return { ...base, border: "1px solid rgba(255,80,80,0.75)" };
  if (level === "high") return { ...base, border: "1px solid rgba(255,160,80,0.75)" };
  if (level === "medium") return { ...base, border: "1px solid rgba(255,220,120,0.65)" };
  if (level === "low") return { ...base, border: "1px solid rgba(140,220,140,0.55)" };
  return { ...base, border: "1px solid rgba(200,200,200,0.35)" };
}

function cardBorder(burning: number, soon: number): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
  };
  if (burning > 0) return { ...base, border: "1px solid rgba(255,80,80,0.28)" };
  if (soon > 0) return { ...base, border: "1px solid rgba(255,160,80,0.22)" };
  return { ...base, border: "1px solid rgba(140,220,140,0.16)" };
}

function fmtDate(deadline?: string | null): string {
  if (!deadline) return "-";
  return String(deadline).slice(0, 10);
}

export function ClientTasksSummaryCard(props: Props) {
  const { clientId, title } = props;

  const summary = useMemo(() => {
    const tasks = loadMaterializedTasksV27(clientId) as any[];
    let burning = 0;
    let soon = 0;
    let calm = 0;
    let other = 0;

    const dueList: { due: string; title: string; level: string; days: number | null }[] = [];

    for (const t of tasks) {
      const risk = deriveRisk((t as any)?.deadline);
      const level = risk.riskLevel;

      if (level === "critical") burning += 1;
      else if (level === "high") soon += 1;
      else if (level === "medium" || level === "low") calm += 1;
      else other += 1;

      dueList.push({
        due: fmtDate((t as any)?.deadline),
        title: String((t as any)?.title ?? (t as any)?.key ?? "task"),
        level,
        days: risk.daysToDeadline ?? null,
      });
    }

    dueList.sort((a, b) => {
      const da = typeof a.days === "number" ? a.days : 999999;
      const db = typeof b.days === "number" ? b.days : 999999;
      if (da !== db) return da - db;
      return a.title.localeCompare(b.title);
    });

    return {
      total: tasks.length,
      burning,
      soon,
      calm,
      other,
      next3: dueList.slice(0, 3),
    };
  }, [clientId]);

  const href = `/tasks?client=${encodeURIComponent(clientId)}`;

  return (
    <div style={cardBorder(summary.burning, summary.soon)}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{title ?? "Tasks"}</div>
        <div style={{ opacity: 0.8, fontSize: 12 }}>
          <Link to={href} style={{ textDecoration: "none" }}>
            Open tasks
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={pill("critical")}>burning: {summary.burning}</span>
        <span style={pill("high")}>soon: {summary.soon}</span>
        <span style={pill("low")}>calm: {summary.calm}</span>
        <span style={pill("unknown")}>other: {summary.other}</span>
        <span style={pill("unknown")}>total: {summary.total}</span>
      </div>

      <div style={{ marginTop: 10, opacity: 0.85, fontSize: 12, fontWeight: 700 }}>Next deadlines</div>
      {summary.next3.length === 0 ? (
        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
          No local tasks yet. Use "Materialize (local)" on Tasks page.
        </div>
      ) : (
        <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
          {summary.next3.map((x, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {x.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={pill(x.level)}>{x.level}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{x.due}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <Link to={href} style={{ textDecoration: "none" }}>
          <button style={{ padding: "6px 10px", borderRadius: 10 }}>Go to tasks</button>
        </Link>
      </div>
    </div>
  );
}