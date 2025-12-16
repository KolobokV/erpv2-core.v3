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
import { fetchProcessInstancesV2Safe, type ProcessInstanceV2 } from "../api/processInstancesV2Safe";
import {
  addProcessIntent,
  clearProcessIntents,
  countProcessIntents,
  hasProcessIntent,
  removeProcessIntent,
  realizeProcessIntent,
  realizeAllForClient,
} from "../v27/processIntentsStore";

type UiTask = any;
type GroupKey = "burning" | "soon" | "calm" | "unknown";

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch {
    return iso;
  }
}

function formatDue(deadline: any): string {
  const iso = String(deadline ?? "").trim();
  if (!iso) return "no_deadline";
  return fmtDate(iso);
}

function sortByPriorityAndTitle(a: any, b: any): number {
  const pa = String(a?.derived?.riskLevel ?? "unknown");
  const pb = String(b?.derived?.riskLevel ?? "unknown");
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 9 };
  const da = order[pa] ?? 9;
  const db = order[pb] ?? 9;
  if (da !== db) return da - db;
  const ta = String(a?.title ?? "");
  const tb = String(b?.title ?? "");
  return ta.localeCompare(tb);
}

function riskToGroup(lvl: string): GroupKey {
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
  if (key === "burning") return "Overdue or due today. Must be handled now.";
  if (key === "soon") return "Due soon. Plan and execute.";
  if (key === "calm") return "Not urgent. Plan and batch.";
  return "Low signal or unknown risk.";
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
  return base;
}

function tinyPill(ok: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    border: ok ? "1px solid rgba(120,220,120,0.45)" : "1px solid rgba(255,160,80,0.55)",
    opacity: 0.95,
    whiteSpace: "nowrap",
  };
}

function sectionStyle(key: GroupKey): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
  };

  if (key === "burning") return { ...base, border: "1px solid rgba(255,80,80,0.35)" };
  if (key === "soon") return { ...base, border: "1px solid rgba(255,160,80,0.35)" };
  if (key === "calm") return { ...base, border: "1px solid rgba(140,220,140,0.22)" };
  return base;
}

function cardStyle(key: GroupKey): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 12,
    opacity: 0.98,
  };

  if (key === "burning") return { ...base, border: "1px solid rgba(255,80,80,0.22)" };
  if (key === "soon") return { ...base, border: "1px solid rgba(255,160,80,0.22)" };
  if (key === "calm") return { ...base, border: "1px solid rgba(140,220,140,0.14)" };
  return base;
}

export default function TasksPage() {
  const location = useLocation();
  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const [derivedCount, setDerivedCount] = useState<number>(0);
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [meta, setMeta] = useState<any>({ count: 0, last_materialize_error: null });
  const [bundleJson, setBundleJson] = useState<string>("");
  const [showBundle, setShowBundle] = useState<boolean>(false);

  const [procItems, setProcItems] = useState<ProcessInstanceV2[]>([]);
  const [procLoading, setProcLoading] = useState<boolean>(false);
  const [procError, setProcError] = useState<string>("");

  const [intentRev, setIntentRev] = useState<number>(0);
  const intentCount = useMemo(() => countProcessIntents(clientId), [clientId, intentRev]);

  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  async function refreshProcesses() {
    if (!clientId) {
      setProcItems([]);
      setProcError("");
      return;
    }
    setProcLoading(true);
    setProcError("");
    try {
      const resp = await fetchProcessInstancesV2Safe();
      const items = Array.isArray(resp?.items) ? resp.items : [];
      const cid = String(clientId).trim().toLowerCase();
      const filtered = items.filter((x: any) => {
        const ck = String(x?.client_key ?? "").trim().toLowerCase();
        return ck === cid || ck.endsWith(":" + cid) || ck.includes(cid);
      });
      setProcItems(filtered);
    } catch (e: any) {
      setProcItems([]);
      setProcError(String(e?.message ?? "fetch_failed"));
    } finally {
      setProcLoading(false);
    }
  }

  useEffect(() => {
    const materialized = loadMaterializedTasksV27(clientId);
    const enriched = materialized
      .map((t: any) => {
        const risk = deriveRisk(t.deadline);
        return {
          ...t,
          derived: {
            ...t.derived,
            riskLevel: risk?.level ?? "unknown",
            daysToDeadline: typeof risk?.daysToDeadline === "number" ? risk.daysToDeadline : null,
          },
        };
      })
      .sort(sortByPriorityAndTitle);

    const bundle: any = buildV27Bundle(clientId, enriched);
    const derived = Array.isArray(bundle?.derived) ? bundle.derived : [];

    setDerivedCount(derived.length);
    setTasks(enriched);
    setMeta(loadMaterializeMetaV27(clientId));
    setBundleJson(JSON.stringify(bundle, null, 2));

    setIntentRev((x) => x + 1);
    void refreshProcesses();
  }, [clientId]);

  function onMaterializeLocal() {
    const currentTasks = loadMaterializedTasksV27(clientId);
    const bundle: any = buildV27Bundle(clientId, currentTasks);
    const derived = Array.isArray(bundle?.derived) ? bundle.derived : [];
    materializeFromDerivedV27(clientId, derived);
    setMeta(loadMaterializeMetaV27(clientId));
    const nextTasks = loadMaterializedTasksV27(clientId).map((t: any) => {
      const risk = deriveRisk(t.deadline);
      return { ...t, derived: { ...t.derived, riskLevel: risk?.level ?? "unknown", daysToDeadline: risk?.daysToDeadline ?? null } };
    });
    setTasks(nextTasks.sort(sortByPriorityAndTitle));

    const nextBundle: any = buildV27Bundle(clientId, nextTasks);
    setDerivedCount(Array.isArray(nextBundle?.derived) ? nextBundle.derived.length : 0);
    setBundleJson(JSON.stringify(nextBundle, null, 2));
  }

  function onResetLocal() {
    resetMaterializedTasksV27(clientId);
    setMeta(loadMaterializeMetaV27(clientId));
    setTasks([]);
    const bundle: any = buildV27Bundle(clientId, []);
    setDerivedCount(Array.isArray(bundle?.derived) ? bundle.derived.length : 0);
    setBundleJson(JSON.stringify(bundle, null, 2));
  }

  async function onRealizeOne(taskKey: string) {
    if (!clientId) return;
    const k2 = String(taskKey ?? "").trim();
    if (!k2) return;

    try {
      await realizeProcessIntent(clientId, k2);
      setIntentRev((x) => x + 1);
      await refreshProcesses();
    } catch (e: any) {
      setProcError(String(e?.message ?? "realize_failed"));
      setIntentRev((x) => x + 1);
    }
  }

  async function onRealizeAll() {
    if (!clientId) return;
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      await realizeAllForClient(clientId);
      setIntentRev((x) => x + 1);
      await refreshProcesses();
    } catch (e) {
      console.error("bulk_realize_failed", e);
    } finally {
      setBulkBusy(false);
    }
  }

  const groups = useMemo(() => {
    const g: Record<GroupKey, UiTask[]> = { burning: [], soon: [], calm: [], unknown: [] };
    for (const t of tasks) {
      const lvl = String(t?.derived?.riskLevel ?? "unknown");
      g[riskToGroup(lvl)].push(t);
    }
    g.burning.sort(sortByPriorityAndTitle);
    g.soon.sort(sortByPriorityAndTitle);
    g.calm.sort(sortByPriorityAndTitle);
    g.unknown.sort(sortByPriorityAndTitle);
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

            <div style={{ fontSize: 12, opacity: 0.85 }}>
              <div>process read</div>
              <div>
                instances: {procItems.length} | {procLoading ? "loading" : procError ? `error:${procError}` : "ok"}
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.85 }}>
              <div>process queue</div>
              <div>queued: {intentCount}</div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={onMaterializeLocal} style={{ padding: "6px 10px", borderRadius: 10 }}>
                Materialize (local)
              </button>
              <button onClick={onResetLocal} style={{ padding: "6px 10px", borderRadius: 10 }}>
                Reset (local)
              </button>
              <button
                onClick={() => void refreshProcesses()}
                style={{ padding: "6px 10px", borderRadius: 10 }}
                disabled={!clientId || procLoading}
              >
                Refresh processes
              </button>
              <button
                onClick={() => void onRealizeAll()}
                style={{ padding: "6px 10px", borderRadius: 10 }}
                disabled={!clientId || intentCount === 0 || bulkBusy}
              >
                {bulkBusy ? "Realize queued..." : "Realize queued"}
              </button>
              <button
                onClick={() => {
                  if (!clientId) return;
                  clearProcessIntents(clientId);
                  setIntentRev((x) => x + 1);
                }}
                style={{ padding: "6px 10px", borderRadius: 10 }}
                disabled={!clientId}
              >
                Clear queue
              </button>
              <button
                onClick={() => {
                  if (!clientId) return;
                  window.location.href = `/processes?client=${encodeURIComponent(clientId)}`;
                }}
                style={{ padding: "6px 10px", borderRadius: 10 }}
                disabled={!clientId}
              >
                Open processes
              </button>
              <button onClick={() => setShowBundle((v) => !v)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                {showBundle ? "Hide bundle" : "Show bundle"}
              </button>
            </div>
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

                    const tk = String(t?.key ?? "").trim();
                    const isQueued = !!clientId && !!tk && hasProcessIntent(clientId, tk);

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

                        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={tinyPill(procItems.length > 0)}>{procItems.length > 0 ? "proc" : "no-proc"}</span>
                          <span style={tinyPill(isQueued)}>{isQueued ? "queued" : "not-queued"}</span>

                          <button
                            onClick={() => {
                              if (!clientId) return;
                              const k2 = String(t.key ?? "").trim();
                              if (!k2) return;
                              addProcessIntent(clientId, k2);
                              setIntentRev((x) => x + 1);
                            }}
                            style={{ padding: "4px 8px", borderRadius: 10, fontSize: 12, opacity: 0.95 }}
                            disabled={!clientId || !t?.key}
                          >
                            Queue
                          </button>

                          <button
                            onClick={() => {
                              const k2 = String(t.key ?? "").trim();
                              if (!k2) return;
                              void onRealizeOne(k2);
                            }}
                            style={{ padding: "4px 8px", borderRadius: 10, fontSize: 12, opacity: 0.95 }}
                            disabled={!clientId || !t?.key || procLoading}
                          >
                            Realize
                          </button>

                          <button
                            onClick={() => {
                              if (!clientId) return;
                              const k2 = String(t.key ?? "").trim();
                              if (!k2) return;
                              removeProcessIntent(clientId, k2);
                              setIntentRev((x) => x + 1);
                            }}
                            style={{ padding: "4px 8px", borderRadius: 10, fontSize: 12, opacity: 0.85 }}
                            disabled={!clientId || !t?.key}
                          >
                            Unqueue
                          </button>
                        </div>
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