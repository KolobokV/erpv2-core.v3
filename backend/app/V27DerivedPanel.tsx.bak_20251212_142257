import React, { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "./RiskBadge";
import { fetchTasksAll, TaskItem } from "../api/taskApi";
import { fetchProcessInstances, ProcessInstance } from "../api/internalProcessesApi";

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

function pickTag(it: any): string {
  const domain =
    (typeof it?.domain === "string" && it.domain) ||
    (typeof it?.group === "string" && it.group) ||
    (typeof it?.type === "string" && it.type) ||
    "";
  const cadence =
    (typeof it?.cadence === "string" && it.cadence) ||
    (typeof it?.period === "string" && it.period) ||
    (typeof it?.freq === "string" && it.freq) ||
    "";
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

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const [tAll, pAll] = await Promise.all([fetchTasksAll(), fetchProcessInstances()]);
        if (!mounted) return;

        const client = props.clientId;

        const t = (tAll?.items || []).filter((x) => String(x?.client || "") === String(client));
        const p = (pAll || []).filter((x) => String(x?.client_profile_id || "") === String(client));

        setTasks(t);
        setProc(p);
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
                  Derived exists, but no tasks/process instances found for this client. This is expected early in v27, but
                  it signals missing generation wiring.
                </div>
              ) : null}

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

              {tasks.length > 0 ? (
                <div className="rounded-md border border-slate-200">
                  <div className="px-3 py-2 text-xs font-semibold border-b border-slate-200">sample tasks (up to 5)</div>
                  <div className="divide-y">
                    {tasks.slice(0, 5).map((t) => (
                      <div key={String(t.id)} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm">{t.title}</div>
                        <div className="text-xs text-slate-500">
                          {(t as any).status || "?"} · {(t as any).due_date ? String((t as any).due_date).slice(0, 10) : "no due"}
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
                    {proc.slice(0, 5).map((p) => (
                      <div key={String(p.id)} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="text-sm">def: {p.definition_id} · id: {shortId(p.id)}</div>
                        <div className="text-xs text-slate-500">{(p as any).status || "?"} · {(p as any).period_key || "no period"}</div>
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
                <div key={String(r?.code || idx)} className="px-3 py-2 flex items-center justify-between gap-3">
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