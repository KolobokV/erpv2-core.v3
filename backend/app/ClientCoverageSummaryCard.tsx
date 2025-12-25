import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { loadClientProfileV27, loadMaterializedTasksV27 } from "../v27/profileStore";
import { deriveReglementV27 } from "../v27/deriveReglement";
import { computeCoverageFromDerivedAndTasks } from "../v27/coverage";

type Props = {
  clientId: string;
  title?: string;
  rev?: number;
};

function borderStyle(uncovered: number): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(120,120,120,0.35)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(255,255,255,0.02)",
  };
  if (uncovered > 0) {
    return {
      ...base,
      border: "1px solid rgba(255,160,80,0.40)",
      boxShadow: "0 0 0 1px rgba(255,160,80,0.12) inset",
    };
  }
  return base;
}

function pill(ok: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    border: ok ? "1px solid rgba(120,220,120,0.45)" : "1px solid rgba(255,160,80,0.55)",
    opacity: 0.95,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

export function ClientCoverageSummaryCard(props: Props) {
  const { clientId, title = "Coverage", rev } = props;

  const result = useMemo(() => {
    const profile = loadClientProfileV27(clientId);
    const derived = Array.isArray(profile) ? [] : deriveReglementV27(profile);
    const tasks = loadMaterializedTasksV27(clientId);
    return computeCoverageFromDerivedAndTasks(derived as any[], tasks as any[]);
  }, [clientId, rev]);

  const hrefTasks = `/tasks?client=${encodeURIComponent(clientId)}`;
  const hrefReglement = `/reglement?client=${encodeURIComponent(clientId)}`;

  const topMissing = result.uncoveredItems.slice(0, 6);

  return (
    <div style={borderStyle(result.uncovered)}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={pill(result.uncovered === 0)}>
            {result.covered}/{result.derivedTotal} covered
          </span>
          <span style={pill(result.uncovered === 0)}>
            {result.uncovered} missing
          </span>
          <Link to={hrefTasks} style={{ fontSize: 12, opacity: 0.9 }}>Open tasks</Link>
          <Link to={hrefReglement} style={{ fontSize: 12, opacity: 0.9 }}>Open reglement</Link>
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        Derived items are expected obligations. Coverage checks if each derived key has a local task with the same key.
      </div>

      {result.uncovered > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>Missing (top)</div>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {topMissing.map((it) => (
              <div
                key={it.key}
                style={{
                  border: "1px solid rgba(255,160,80,0.25)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{it.title || it.key}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{it.key}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
                  materialize in Tasks
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          Looks good. Local tasks cover all derived items.
        </div>
      )}
    </div>
  );
}

export default ClientCoverageSummaryCard;