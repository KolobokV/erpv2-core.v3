import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* =======================
   Types
======================= */

type Step = {
  id?: string;
  key?: string;
  title?: string;
  name?: string;
  status?: string;
  computed_status?: string;
  deadline?: string;
  due_date?: string;
  target_date?: string;
};

type Instance = {
  id?: string;
  instance_id?: string;
  instance_key?: string;
  key?: string;
  client_label?: string;
  client_code?: string;
  client_id?: string;
  profile_code?: string;
  profile_id?: string;
  period?: string;
  status?: string;
  computed_status?: string;
  steps?: Step[];
};

/* =======================
   Helpers
======================= */

function safeStr(v: any): string {
  return v === null || v === undefined ? "" : String(v);
}

function extractInstances(j: any): Instance[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.instances)) return j.instances;
  if (Array.isArray(j.items)) return j.items;
  return [];
}

function normalizeStatus(raw?: string | null): "open" | "closed" | "error" | "unknown" {
  const s = (raw || "").toLowerCase().trim();
  if (["completed", "closed", "done"].includes(s)) return "closed";
  if (["planned", "open", "in_progress", "in-progress"].includes(s)) return "open";
  if (["error", "failed", "stuck"].includes(s)) return "error";
  return "unknown";
}

function getStableInstanceId(i: Instance): string {
  return (
    safeStr(i.instance_id) ||
    safeStr(i.id) ||
    safeStr(i.instance_key) ||
    safeStr(i.key) ||
    safeStr(i.client_code || i.client_id) + "::" + safeStr(i.period)
  );
}

function getClientKey(i: Instance): string {
  return safeStr(i.client_code || i.client_id || i.client_label);
}

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function isOverdue(step: Step): boolean {
  const status = normalizeStatus(step.computed_status || step.status);
  if (status === "closed") return false;
  const d = parseDate(step.deadline || step.due_date || step.target_date);
  if (!d) return false;
  return d.getTime() < new Date().setHours(0, 0, 0, 0);
}

function stripNumber(label: string): string {
  return label.replace(/^\s*\d+\s*[\.\)]\s*/, "");
}

function getClientFromSearch(search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    return (sp.get("client") || "").trim();
  } catch {
    return "";
  }
}

function clearClientFromUrl(pathname: string, search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    if (!sp.has("client")) return pathname + (search || "");
    sp.delete("client");
    const next = sp.toString();
    return pathname + (next ? "?" + next : "");
  } catch {
    return pathname;
  }
}

function instanceHasRisk(i: Instance): boolean {
  const steps = i.steps || [];
  return steps.some(isOverdue);
}

/* =======================
   Component
======================= */

const InternalProcessesPage: React.FC = () => {
  const [items, setItems] = useState<Instance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loc = useLocation();
  const nav = useNavigate();
  const client = useMemo(() => getClientFromSearch(loc.search), [loc.search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadError(null);

        const r = await fetch("/api/internal/process-instances-v2/");

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          const msg = "HTTP " + String(r.status) + (txt ? ": " + txt.slice(0, 200) : "");
          if (!cancelled) {
            setItems([]);
            setLoadError(msg);
          }
          return;
        }

        const raw = await r.text();
        if (!raw || raw.trim().length === 0) {
          if (!cancelled) {
            setItems([]);
            setLoadError("Empty response");
          }
          return;
        }

        let j: any = null;
        try {
          j = JSON.parse(raw);
        } catch {
          if (!cancelled) {
            setItems([]);
            setLoadError("Invalid JSON response");
          }
          return;
        }

        const list = extractInstances(j);
        if (!cancelled) {
          setItems(list);
        }
      } catch (e: any) {
        if (!cancelled) {
          setItems([]);
          setLoadError(String(e?.message || e || "Request failed"));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!client) return items;
    return items.filter((i) => getClientKey(i) === client);
  }, [items, client]);

  useEffect(() => {
    const list = filteredItems;
    if (list.length === 0) {
      setSelectedId(null);
      return;
    }
    const preferred = selectedId && list.some((i) => getStableInstanceId(i) === selectedId);
    if (!preferred) {
      setSelectedId(getStableInstanceId(list[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, filteredItems.length]);

  const selected = useMemo(
    () => filteredItems.find((i) => getStableInstanceId(i) === selectedId) || null,
    [filteredItems, selectedId]
  );

  const steps = selected?.steps || [];
  const stepStatuses = steps.map((s) => normalizeStatus(s.computed_status || s.status));

  const total = steps.length;
  const closed = stepStatuses.filter((s) => s === "closed").length;
  const progress = total ? Math.round((closed / total) * 100) : 0;

  const currentIdx = stepStatuses.findIndex((s) => s !== "closed");
  const currentStep = currentIdx >= 0 ? steps[currentIdx] : null;

  const overdueSteps = steps.filter(isOverdue);
  const hasRisk = overdueSteps.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Internal processes</h1>

          {client && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
              <span className="text-slate-500">client</span>
              <span className="font-medium">{client}</span>
              <button
                type="button"
                className="rounded-full px-1 text-[11px] text-slate-500 hover:bg-slate-100"
                title="Clear client context"
                onClick={() => nav(clearClientFromUrl(loc.pathname, loc.search))}
              >
                x
              </button>
            </div>
          )}
        </div>

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {"Failed to load process instances: " + loadError}
          </div>
        ) : null}


        <div className="grid lg:grid-cols-2 gap-4">
          {/* ===== Instances list ===== */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b text-sm font-semibold">
              Instances {client ? "(filtered)" : ""}
            </div>

            {filteredItems.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-600">No instances</div>
            ) : (
              filteredItems.map((i) => {
                const id = getStableInstanceId(i);
                const st = normalizeStatus(i.computed_status || i.status);
                const risk = instanceHasRisk(i);

                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={
                      "w-full text-left px-4 py-3 border-b hover:bg-slate-50 " +
                      (id === selectedId ? "bg-sky-50" : "")
                    }
                  >
                    <div className="font-medium">
                      {i.client_label || i.client_code || i.client_id}
                    </div>
                    <div className="text-xs text-slate-500">{i.period}</div>
                    <div className="text-xs mt-1">
                      status: <span className={risk ? "text-red-600" : ""}>{st}</span>
                      {risk ? <span className="ml-2 text-red-700">risk</span> : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* ===== Process card ===== */}
          {selected && (
            <div className="bg-white border rounded-xl p-4 space-y-4">
              <div className="flex justify-between">
                <div>
                  <div className="text-xs text-slate-500">Client</div>
                  <div className="font-semibold">
                    {selected.client_label || selected.client_code || selected.client_id}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Period</div>
                  <div className="font-semibold">{selected.period}</div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                <div>
                  Progress: {closed} / {total} ({progress}%)
                </div>
                {currentStep && (
                  <div>
                    Next action:{" "}
                    <span className="font-medium">
                      {stripNumber(currentStep.title || currentStep.name || "")}
                    </span>
                  </div>
                )}
                {hasRisk && (
                  <div className="text-red-700">
                    Risk: {overdueSteps.length} overdue step(s)
                  </div>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase">Steps</div>
                {steps.map((s, idx) => {
                  const st = normalizeStatus(s.computed_status || s.status);
                  const overdue = isOverdue(s);
                  return (
                    <div
                      key={idx}
                      className={
                        "border rounded p-2 " +
                        (overdue
                          ? "bg-red-50 border-red-200"
                          : st === "closed"
                          ? "bg-emerald-50"
                          : idx === currentIdx
                          ? "bg-sky-50"
                          : "bg-white")
                      }
                    >
                      <div className="text-sm font-medium">
                        {idx + 1}. {stripNumber(s.title || s.name || "")}
                      </div>
                      <div className="text-xs text-slate-600">
                        status: {st}
                        {overdue && " (overdue)"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InternalProcessesPage;