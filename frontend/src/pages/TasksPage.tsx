import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { UpBackBar } from "../components/UpBackBar";
import { getClientFromLocation } from "../v27/clientContext";
import { buildV27Bundle } from "../v27/bridge";
import {
  loadMaterializedTasksV27,
  materializeFromDerivedV27,
  resetMaterializedTasksV27,
  loadMaterializeMetaV27,
} from "../v27/profileStore";
import { deriveRisk } from "../v27/riskPriority";

type UiTask = any;
type GroupKey = "burning" | "soon" | "calm" | "unknown";

function groupKeyFromTask(t: any): GroupKey {
  const lvl = t?.derived?.riskLevel;
  if (lvl === "critical") return "burning";
  if (lvl === "high") return "soon";
  if (lvl === "medium" || lvl === "low") return "calm";
  return "unknown";
}

function groupTitle(key: GroupKey, count: number): string {
  if (key === "burning") return `Burning (${count})`;
  if (key === "soon") return `Soon (${count})`;
  if (key === "calm") return `Calm (${count})`;
  return `Other (${count})`;
}

function groupHint(key: GroupKey): string {
  if (key === "burning") return "Overdue or due today. Must be handled first.";
  if (key === "soon") return "Due within 1 day. Keep in focus.";
  if (key === "calm") return "Not urgent. Plan and batch.";
  return "No risk info. Needs review.";
}

function pillStyle(level: string): React.CSSProperties {
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

function cardStyle(key: GroupKey): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
  };

  if (key === "burning") return { ...base, border: "1px solid rgba(255,80,80,0.35)" };
  if (key === "soon") return { ...base, border: "1px solid rgba(255,160,80,0.30)" };
  if (key === "calm") return { ...base, border: "1px solid rgba(140,220,140,0.22)" };
  return base;
}

function sectionStyle(key: GroupKey): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 12,
  };

  if (key === "burning") return { ...base, border: "1px solid rgba(255,80,80,0.22)" };
  if (key === "soon") return { ...base, border: "1px solid rgba(255,160,80,0.20)" };
  if (key === "calm") return { ...base, border: "1px solid rgba(140,220,140,0.16)" };
  return base;
}

function sortByPriorityAndTitle(a: any, b: any): number {
  const pa = a?.derived?.priority ?? "p9";
  const pb = b?.derived?.priority ?? "p9";
  const cmp = String(pa).localeCompare(String(pb));
  if (cmp !== 0) return cmp;
  return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
}

function formatDue(deadline?: string | null): string {
  if (!deadline) return "no due";
  return String(deadline).slice(0, 10);
}

export default function TasksPage() {
  const location = useLocation();
  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const [derivedCount, setDerivedCount] = useState<number>(0);
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [meta, setMeta] = useState<any>({ count: 0, last_materialize_error: null });
  const [bundleJson, setBundleJson] = useState<string>("");
  const [showBundle, setShowBundle] = useState<boolean>(false);

  useEffect(() => {
    const materialized = loadMaterializedTasksV27(clientId);
    const enriched = materialized
      .map((t: any) => {
        const risk = deriveRisk(t.deadline);
        return { ...t, derived: risk };
      })
      .sort(sortByPriorityAndTitle);

    const bundle: any = buildV27Bundle(clientId, enriched);
    const derived = Array.isArray(bundle?.derived) ? bundle.derived : [];

    setDerivedCount(derived.length);
    setTasks(enriched);
    setMeta(loadMaterializeMetaV27(clientId));
    setBundleJson(JSON.stringify(bundle, null, 2));
  }, [clientId]);

  function onMaterializeLocal() {
    const currentTasks = loadMaterializedTasksV27(clientId);
    const bundle: any = buildV27Bundle(clientId, currentTasks);
    const derived = Array.isArray(bundle?.derived) ? bundle.derived : [];

    const created = materializeFromDerivedV27(clientId, derived);

    const enriched = created
      .map((t: any) => {
        const risk = deriveRisk(t.deadline);
        return { ...t, derived: risk };
      })
      .sort(sortByPriorityAndTitle);

    const nextBundle: any = buildV27Bundle(clientId, enriched);

    setDerivedCount(derived.length);
    setTasks(enriched);
    setMeta(loadMaterializeMetaV27(clientId));
    setBundleJson(JSON.stringify(nextBundle, null, 2));
  }

  function onResetLocal() {
    resetMaterializedTasksV27(clientId);

    const bundle: any = buildV27Bundle(clientId, []);
    const derived = Array.isArray(bundle?.derived) ? bundle.derived : [];

    setDerivedCount(derived.length);
    setTasks([]);
    setMeta(loadMaterializeMetaV27(clientId));
    setBundleJson(JSON.stringify(bundle, null, 2));
  }

  const groups = useMemo(() => {
    const g: Record<GroupKey, UiTask[]> = { burning: [], soon: [], calm: [], unknown: [] };
    for (const t of tasks) g[groupKeyFromTask(t)].push(t);
    for (const k of Object.keys(g) as GroupKey[]) g[k] = g[k].slice().sort(sortByPriorityAndTitle);
    return g;
  }, [tasks]);

  const summary = useMemo(() => {
    return {
      burning: groups.burning.length,
      soon: groups.soon.length,
      calm: groups.calm.length,
      unknown: groups.unknown.length,
    };
  }, [groups]);

  const showEmptyHint = derivedCount > 0 && tasks.length === 0;

  return (
    <PageShell>
      <UpBackBar title={`Tasks: ${clientId || "-"}`} />

      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Reality check (tasks + processes)</div>
          <div style={{ opacity: 0.75 }}>{clientId ? "ok" : "client missing"}</div>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span style={pillStyle("critical")}>burning: {summary.burning}</span>
          <span style={pillStyle("high")}>soon: {summary.soon}</span>
          <span style={pillStyle("low")}>calm: {summary.calm}</span>
          <span style={pillStyle("unknown")}>other: {summary.unknown}</span>
        </div>

        <div
          style={{
            marginTop: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: 12,
            opacity: 0.98,
          }}
        >
          <div style={{ opacity: 0.9 }}>
            {showEmptyHint
              ? "Derived exists, but no tasks found for this client. Use local materialization to preview UX wiring."
              : "State looks consistent."}
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              <div>local materialization</div>
              <div>
                count: {meta?.count ?? 0} | last: {meta?.last_materialize_error ?? "-"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onMaterializeLocal} style={{ padding: "6px 10px", borderRadius: 10 }}>
                Materialize (local)
              </button>
              <button onClick={onResetLocal} style={{ padding: "6px 10px", borderRadius: 10 }}>
                Reset (local)
              </button>
              <button onClick={() => setShowBundle((v) => !v)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                {showBundle ? "Hide bundle" : "Show bundle"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>tasks</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{tasks.length}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {(["burning", "soon", "calm", "unknown"] as GroupKey[]).map((k) => {
            const items = groups[k];
            if (items.length === 0) return null;

            return (
              <div key={k} style={sectionStyle(k)}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 800 }}>{groupTitle(k, items.length)}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{groupHint(k)}</div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {items.map((t: any) => {
                    const level = t?.derived?.riskLevel ?? "unknown";
                    const days = t?.derived?.daysToDeadline;
                    const dtag = typeof days === "number" ? `D${days}` : "D?";
                    const due = formatDue(t?.deadline);

                    return (
                      <div key={t.id} style={cardStyle(k)}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 800 }}>{t.title}</div>
                          <div style={pillStyle(level)}>{`${level} | ${dtag} | ${due}`}</div>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.82 }}>
                          key: {t.key ?? "-"} | source: {t.source ?? "-"} | periodicity: {t.periodicity ?? "-"}
                        </div>

                        {t.reason ? (
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
                            reason: {t.reason}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {showBundle ? (
          <div style={{ marginTop: 14 }}>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{bundleJson}</pre>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}