import React, { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "./RiskBadge";
import { fetchTasksAll, TaskItem } from "../api/taskApi";
import { fetchProcessInstances, ProcessInstance } from "../api/internalProcessesApi";
import { loadMaterializedTasksV27, materializeFromDerivedV27, resetMaterializedTasksV27, V27MaterializedTask } from "../v27/profileStore";

type DerivedLike =
  | Array<any>
  | {
      items?: any[];
      obligations?: any[];
      derived?: any[];
    }
  | null
  | undefined;

type RiskLike = Array<any> | { items?: any[] } | null | undefined;

function asArray(x: any): any[] {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray((x as any).items)) return (x as any).items;
  if (Array.isArray((x as any).obligations)) return (x as any).obligations;
  if (Array.isArray((x as any).derived)) return (x as any).derived;
  return [];
}

function pickTitle(it: any): string {
  return (
    (typeof it?.title === "string" && it.title) ||
    (typeof it?.name === "string" && it.name) ||
    (typeof it?.label === "string" && it.label) ||
    (typeof it?.key === "string" && it.key) ||
    "Untitled"
  );
}

function pickCadence(it: any): string {
  return (
    (typeof it?.cadence === "string" && it.cadence) ||
    (typeof it?.period === "string" && it.period) ||
    (typeof it?.freq === "string" && it.freq) ||
    (typeof it?.schedule === "string" && it.schedule) ||
    ""
  );
}

function pickTag(it: any): string {
  const domain =
    (typeof it?.domain === "string" && it.domain) ||
    (typeof it?.group === "string" && it.group) ||
    (typeof it?.type === "string" && it.type) ||
    "";
  const cadence = pickCadence(it);
  const right =
    (typeof it?.tag === "string" && it.tag) ||
    (typeof it?.right === "string" && it.right) ||
    "";

  const combined = [domain, cadence].filter(Boolean).join(" · ");
  if (right) return right;
  if (combined) return combined.toUpperCase();
  return "";
}

function normalizeRiskText(r: any): string {
  return (
    (typeof r?.message === "string" && r.message) ||
    (typeof r?.title === "string" && r.title) ||
    (typeof r?.text === "string" && r.text) ||
    (typeof r?.code === "string" && r.code) ||
    "Risk"
  );
}

function normalizeRiskCode(r: any): string {
  return (typeof r?.code === "string" && r.code) || "RISK";
}

function normalizeRiskSeverity(r: any): string {
  return (
    (typeof r?.severity === "string" && r.severity) ||
    (typeof r?.level === "string" && r.level) ||
    "info"
  );
}

function shortId(x: any): string {
  const s = String(x ?? "");
  if (s.length <= 10) return s;
  return s.slice(0, 6) + "…" + s.slice(-2);
}

function normText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMatch(taskTitle: string, derivedTitle: string): boolean {
  const t = normText(taskTitle);
  const d = normText(derivedTitle);
  if (!t || !d) return false;
  if (t === d) return true;
  if (t.includes(d)) return true;
  if (d.includes(t) && t.length >= 6) return true;
  return false;
}

function toTaskItemLocal(t: V27MaterializedTask): TaskItem {
  return {
    id: t.id,
    client: t.client,
    title: t.title,
    status: t.status,
    due_date: t.due_date,
  } as any;
}

export function V27DerivedPanel(props: {
  title: string;
  clientId: string;
  derived: DerivedLike;
  risks: RiskLike;
}) {
  const derivedItems = useMemo(() => asArray(props.derived), [props.derived]);
  const riskItems = useMemo(() => asArray(props.risks), [props.risks]);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [proc, setProc] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [localInfo, setLocalInfo] = useState<{ count: number; lastAction: string; lastError: string | null }>({
    count: 0,
    lastAction: "none",
    lastError: null,
  });

  const derivedForMaterialize = useMemo(() => {
    return derivedItems.map((it) => ({ title: pickTitle(it), cadence: pickCadence(it) }));
  }, [derivedItems]);

  const reloadLocalOnly = () => {
    const res = loadMaterializedTasksV27(props.clientId);
    if (!res.ok) {
      setLocalInfo({ count: 0, lastAction: "local_read_error", lastError: String(res.error || "error") });
      return [];
    }
    setLocalInfo((x) => ({ ...x, count: res.items.length }));
    return res.items;
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const [tAll, pAll] = await Promise.all([fetchTasksAll(), fetchProcessInstances()]);
        if (!mounted) return;

        const client = props.clientId;

        const backendTasks = (tAll?.items || []).filter((x) => String(x?.client || "") === String(client));
        const backendProc = (pAll || []).filter((x) => String(x?.client_profile_id || "") === String(client));

        const localRes = loadMaterializedTasksV27(client);
        const localItems = localRes.ok ? localRes.items : [];
        setLocalInfo((x) => ({
          ...x,
          count: localItems.length,
          lastError: localRes.ok ? null : String(localRes.error || "local_error"),
        }));

        const localTasks = localItems.map(toTaskItemLocal);

        const merged = [...backendTasks];
        const seen = new Set<string>(merged.map((x) => String((x as any).id)));
        localTasks.forEach((lt) => {
          const id = String((lt as any).id);
          if (!seen.has(id)) merged.push(lt);
        });

        setTasks(merged);
        setProc(backendProc);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ? String(e.message) : "Reality check load failed");
        setTasks([]);
        setProc([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [props.clientId]);

  const hasDerived = derivedItems.length > 0;
  const hasReality = tasks.length > 0 || proc.length > 0;

  const warnNoReality = hasDerived && !hasReality;
  const warnNoTasks = hasDerived && tasks.length === 0;
  const warnNoProc = hasDerived && proc.length === 0;

  const mismatch = useMemo(() => {
    const derivedTitles = derivedItems.map((it) => pickTitle(it));

    const present: Array<{ title: string; matches: TaskItem[] }> = [];
    const missing: Array<{ title: string }> = [];

    derivedTitles.forEach((dt) => {
      const matches = tasks.filter((t) => isMatch(t.title, dt));
      if (matches.length > 0) present.push({ title: dt, matches });
      else missing.push({ title: dt });
    });

    const unexpected: TaskItem[] = tasks.filter((t) => {
      return !derivedTitles.some((dt) => isMatch(t.title, dt));
    });

    return { present, missing, unexpected };
  }, [derivedItems, tasks]);

  const onMaterializeLocal = () => {
    try {
      const res = materializeFromDerivedV27(props.clientId, derivedForMaterialize);
      if (!res.ok) {
        setLocalInfo((x) => ({ ...x, lastAction: "materialize_error", lastError: String(res.error || "error") }));
        return;
      }
      const items = reloadLocalOnly();
      setLocalInfo((x) => ({
        ...x,
        count: items.length,
        lastAction: "materialized_local created=" + String(res.created) + " updated=" + String(res.updated),
        lastError: null,
      }));

      const localTasks = items.map(toTaskItemLocal);
      setTasks((prev) => {
        const merged = [...prev];
        const seen = new Set<string>(merged.map((x) => String((x as any).id)));
        localTasks.forEach((lt) => {
          const id = String((lt as any).id);
          if (!seen.has(id)) merged.push(lt);
        });
        return merged;
      });
    } catch (e: any) {
      setLocalInfo((x) => ({ ...x, lastAction: "materialize_exception", lastError: String(e?.message || e) }));
    }
  };

  const onResetLocal = () => {
    try {
      const res = resetMaterializedTasksV27(props.clientId);
      if (!res.ok) {
        setLocalInfo((x) => ({ ...x, lastAction: "reset_error", lastError: String(res.error || "error") }));
        return;
      }
      setLocalInfo({ count: 0, lastAction: "reset_local", lastError: null });
      setTasks((prev) => prev.filter((t: any) => !String(t?.id || "").startsWith("v27_")));
    } catch (e: any) {
      setLocalInfo((x) => ({ ...x, lastAction: "reset_exception", lastError: String(e?.message || e) }));
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{props.title}</div>
          <div className="text-sm text-slate-500">client: {props.clientId}</div>
        </div>
        <div className="flex items-center gap-2">{riskItems.length > 0 ? <RiskBadge value={riskItems.length} /> : null}</div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-slate-200">
          <div className="px-3 py-2 text-sm font-semibold border-b border-slate-200">Derived obligations</div>

          {derivedItems.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">No derived items.</div>
          ) : (
            <div className="divide-y">
              {derivedItems.map((it, idx) => (
                <div key={String(it?.key || idx)} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-sm">{pickTitle(it)}</div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">{pickTag(it)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="px-3 py-2 text-sm font-semibold border-b border-slate-200 flex items-center justify-between gap-3">
            <div>Reality check (tasks + processes)</div>
            <div className="text-xs text-slate-500">{loading ? "loading..." : err ? "error" : "ok"}</div>
          </div>

          {err ? (
            <div className="px-3 py-3 text-sm text-red-700">{err}</div>
          ) : (
            <div className="px-3 py-3 space-y-3">
              {warnNoReality ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Derived exists, but no tasks/process instances found for this client. This is expected early in v27, but it signals missing generation wiring.
                </div>
              ) : null}

              <div className="rounded-md border border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">local materialization</div>
                  <div className="text-sm">
                    count: <span className="font-semibold">{localInfo.count}</span> · last:{" "}
                    <span className="font-mono text-xs">{localInfo.lastAction}</span>
                    {localInfo.lastError ? <span className="text-red-700"> · err: {localInfo.lastError}</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" onClick={onMaterializeLocal}>
                    Materialize (local)
                  </button>
                  <button className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" onClick={onResetLocal}>
                    Reset (local)
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-xs text-slate-500">tasks</div>
                  <div className="text-lg font-semibold">{tasks.length}</div>
                  {warnNoTasks ? <div className="text-xs text-amber-700">no tasks yet</div> : null}
                </div>

                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-xs text-slate-500">process instances</div>
                  <div className="text-lg font-semibold">{proc.length}</div>
                  {warnNoProc ? <div className="text-xs text-amber-700">no instances yet</div> : null}
                </div>

                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-xs text-slate-500">derived</div>
                  <div className="text-lg font-semibold">{derivedItems.length}</div>
                  <div className="text-xs text-slate-500">baseline to materialize</div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200">
                <div className="px-3 py-2 text-xs font-semibold border-b border-slate-200">mismatch (derived vs tasks)</div>

                <div className="px-3 py-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-xs text-slate-500">present</div>
                      <div className="text-lg font-semibold">{mismatch.present.length}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-xs text-slate-500">missing</div>
                      <div className="text-lg font-semibold">{mismatch.missing.length}</div>
                    </div>
                    <div className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-xs text-slate-500">unexpected tasks</div>
                      <div className="text-lg font-semibold">{mismatch.unexpected.length}</div>
                    </div>
                  </div>

                  {mismatch.missing.length > 0 ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                      <div className="text-xs font-semibold text-amber-900">missing (top 10)</div>
                      <div className="mt-1 space-y-1">
                        {mismatch.missing.slice(0, 10).map((x, i) => (
                          <div key={i} className="text-sm text-amber-900">
                            {x.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {mismatch.unexpected.length > 0 ? (
                    <div className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="text-xs font-semibold">unexpected tasks (top 10)</div>
                      <div className="mt-1 space-y-1">
                        {mismatch.unexpected.slice(0, 10).map((t) => (
                          <div key={String((t as any).id)} className="flex items-center justify-between gap-3">
                            <div className="text-sm">{t.title}</div>
                            <div className="text-xs text-slate-500">
                              {String((t as any).status || "?") +
                                ((t as any).due_date ? " · " + String((t as any).due_date).slice(0, 10) : "")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {tasks.length > 0 ? (
                <div className="rounded-md border border-slate-200">
                  <div className="px-3 py-2 text-xs font-semibold border-b border-slate-200">sample tasks (up to 10)</div>
                  <div className="divide-y">
                    {tasks.slice(0, 10).map((t: any) => (
                      <div key={String(t.id)} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm">{t.title}</div>
                        <div className="text-xs text-slate-500">
                          {String(t.status || "?") + (t.due_date ? " · " + String(t.due_date).slice(0, 10) : " · no due")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {proc.length > 0 ? (
                <div className="rounded-md border border-slate-200">
                  <div className="px-3 py-2 text-xs font-semibold border-b border-slate-200">sample processes (up to 5)</div>
                  <div className="divide-y">
                    {proc.slice(0, 5).map((p: any) => (
                      <div key={String(p.id)} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm">def: {p.definition_id} · id: {shortId(p.id)}</div>
                        <div className="text-xs text-slate-500">{String(p.status || "?") + " · " + String(p.period_key || "no period")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {riskItems.length > 0 ? (
          <div className="rounded-lg border border-slate-200">
            <div className="px-3 py-2 text-sm font-semibold border-b border-slate-200">Risks</div>
            <div className="divide-y">
              {riskItems.map((r, idx) => (
                <div key={String((r as any)?.code || idx)} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="text-sm">{normalizeRiskText(r)}</div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {normalizeRiskCode(r)} · {normalizeRiskSeverity(r)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default V27DerivedPanel;