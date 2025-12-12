import React, { useEffect, useMemo, useState } from "react";

type ProcessStep = {
  title?: string;
  name?: string;
  status?: string;
  computed_status?: string;
  deadline?: string;
  due_date?: string;
  target_date?: string;
  [key: string]: any;
};

type ProcessInstance = {
  id?: string;
  instance_id?: string;
  instance_key?: string;
  key?: string;
  client_id?: string;
  client_code?: string;
  client_label?: string;
  profile_id?: string;
  profile_code?: string;
  period?: string;
  status?: string;
  computed_status?: string;
  steps?: ProcessStep[];
  [key: string]: any;
};

type Task = {
  id?: string;
  task_id?: string;
  key?: string;
  title?: string;
  name?: string;
  status?: string;
  computed_status?: string;
  due_date?: string;
  deadline?: string;
  target_date?: string;
  client_id?: string;
  client_code?: string;
  client_label?: string;
  [key: string]: any;
};

function safeStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function extractList(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.items)) return j.items;
  if (Array.isArray(j.instances)) return j.instances;
  if (Array.isArray(j.tasks)) return j.tasks;
  if (Array.isArray(j.data)) return j.data;
  return [];
}

function normalizeStatus(raw?: string | null): "open" | "closed" | "error" | "unknown" {
  const s = (raw || "").toLowerCase().trim();
  if (["completed", "closed", "done"].includes(s)) return "closed";
  if (["planned", "open", "in_progress", "in-progress", "todo", "new"].includes(s)) return "open";
  if (["error", "failed", "stuck"].includes(s)) return "error";
  return "unknown";
}

function getClientKey(obj: any): string {
  return safeStr(obj?.client_code || obj?.client_id || obj?.client_label);
}

function stripNumberPrefix(label: string): string {
  return safeStr(label).replace(/^\s*\d+\s*[\.\)]\s*/, "");
}

function parseDate(d?: string): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function dayKey(dt: Date): number {
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isOverdue(due?: string, isClosed?: boolean): boolean {
  if (isClosed) return false;
  const dt = parseDate(due);
  if (!dt) return false;
  return dayKey(dt) < startOfToday();
}

function isToday(due?: string, isClosed?: boolean): boolean {
  if (isClosed) return false;
  const dt = parseDate(due);
  if (!dt) return false;
  return dayKey(dt) === startOfToday();
}

function nextActionFromProcess(p: ProcessInstance | null): string {
  const steps = p?.steps || [];
  for (const s of steps) {
    const st = normalizeStatus(s.computed_status || s.status);
    if (st !== "closed") return stripNumberPrefix(s.title || s.name || "Step");
  }
  return "No open steps";
}

function computeProcessRisk(p: ProcessInstance | null): { hasRisk: boolean; overdueSteps: number } {
  const steps = p?.steps || [];
  let overdueSteps = 0;

  for (const s of steps) {
    const st = normalizeStatus(s.computed_status || s.status);
    if (st === "closed") continue;

    const due = safeStr(s.deadline || s.due_date || s.target_date);
    const dt = parseDate(due);
    if (!dt) continue;

    if (dayKey(dt) < startOfToday()) overdueSteps += 1;
  }

  return { hasRisk: overdueSteps > 0, overdueSteps };
}

type Props = {
  initialClient?: string;
  onClientPicked?: (clientCode: string) => void;
};

const ReglementPage: React.FC<Props> = ({ initialClient, onClientPicked }) => {
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientFilter, setClientFilter] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  const [patchStatus, setPatchStatus] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      setError(null);

      try {
        const [pRes, tRes] = await Promise.all([
          fetch("/api/internal/process-instances-v2/"),
          fetch("/api/tasks"),
        ]);

        const pJson = pRes.ok ? await pRes.json() : null;
        const tJson = tRes.ok ? await tRes.json() : null;

        if (!mounted) return;

        const pList = extractList(pJson) as ProcessInstance[];
        const tList = extractList(tJson) as Task[];

        setProcesses(pList || []);
        setTasks(tList || []);

        const clients = Array.from(
          new Set(
            [...pList.map(getClientKey), ...tList.map(getClientKey)].filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));

        const preferred = safeStr(initialClient).trim();
        if (preferred && clients.includes(preferred)) {
          setSelectedClient(preferred);
          onClientPicked && onClientPicked(preferred);
        } else {
          const first = clients[0] || "";
          setSelectedClient(first);
          if (first) onClientPicked && onClientPicked(first);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Load error");
          setProcesses([]);
          setTasks([]);
          setSelectedClient("");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const preferred = safeStr(initialClient).trim();
    if (preferred && preferred !== selectedClient) {
      setSelectedClient(preferred);
      onClientPicked && onClientPicked(preferred);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClient]);

  const clients = useMemo(() => {
    const all = Array.from(
      new Set([...processes.map(getClientKey), ...tasks.map(getClientKey)].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    if (!clientFilter.trim()) return all;

    const q = clientFilter.trim().toLowerCase();
    return all.filter((c) => c.toLowerCase().includes(q));
  }, [processes, tasks, clientFilter]);

  const selectedProcess = useMemo(() => {
    if (!selectedClient) return null;
    const list = processes.filter((p) => getClientKey(p) === selectedClient);

    list.sort((a, b) => safeStr(b.period).localeCompare(safeStr(a.period)));
    return list[0] || null;
  }, [processes, selectedClient]);

  const risk = useMemo(() => computeProcessRisk(selectedProcess), [selectedProcess]);
  const nextAction = useMemo(() => nextActionFromProcess(selectedProcess), [selectedProcess]);

  const selectedTasks = useMemo(() => {
    if (!selectedClient) return [];
    const list = tasks.filter((t) => getClientKey(t) === selectedClient);

    list.sort((a, b) => {
      const ast = normalizeStatus(a.computed_status || a.status);
      const bst = normalizeStatus(b.computed_status || b.status);
      const aClosed = ast === "closed";
      const bClosed = bst === "closed";

      const ad = safeStr(a.due_date || a.deadline || a.target_date);
      const bd = safeStr(b.due_date || b.deadline || b.target_date);

      const ao = isOverdue(ad, aClosed) ? 1 : 0;
      const bo = isOverdue(bd, bClosed) ? 1 : 0;
      if (ao !== bo) return bo - ao;

      const at = isToday(ad, aClosed) ? 1 : 0;
      const bt = isToday(bd, bClosed) ? 1 : 0;
      if (at !== bt) return bt - at;

      const adt = parseDate(ad)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bdt = parseDate(bd)?.getTime() || Number.MAX_SAFE_INTEGER;
      if (adt !== bdt) return adt - bdt;

      return safeStr(a.title || a.name || "").localeCompare(safeStr(b.title || b.name || ""));
    });

    return list;
  }, [tasks, selectedClient]);

  async function patchTask(taskId: string, payload: any) {
    setPatchStatus("");
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setPatchStatus(`PATCH failed: ${res.status}`);
        return;
      }

      const tRes = await fetch("/api/tasks");
      const tJson = tRes.ok ? await tRes.json() : null;
      const tList = extractList(tJson) as Task[];
      setTasks(tList || []);
      setPatchStatus("OK");
    } catch (e: any) {
      setPatchStatus(e?.message || "PATCH error");
    }
  }

  const tasksOverdue = selectedTasks.filter((t) => {
    const st = normalizeStatus(t.computed_status || t.status);
    const closed = st === "closed";
    const due = safeStr(t.due_date || t.deadline || t.target_date);
    return isOverdue(due, closed);
  }).length;

  const tasksToday = selectedTasks.filter((t) => {
    const st = normalizeStatus(t.computed_status || t.status);
    const closed = st === "closed";
    const due = safeStr(t.due_date || t.deadline || t.target_date);
    return isToday(due, closed);
  }).length;

  const clientBridgeQuery = useMemo(() => {
    if (!selectedClient) return "";
    return `?client=${encodeURIComponent(selectedClient)}`;
  }, [selectedClient]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600">Client filter</label>
            <input
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="mt-1 w-72 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
              placeholder="type client code"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedClient(v);
                onClientPicked && onClientPicked(v);
              }}
              className="mt-1 w-64 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
            >
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-right text-xs text-slate-600">
            <div>Status: {loading ? "loading..." : "ready"}</div>
            {error && <div className="text-red-700">Error: {error}</div>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={"/tasks" + clientBridgeQuery}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            title="Open tasks page (client hint)"
          >
            Open tasks
          </a>
          <a
            href={"/internal-processes" + clientBridgeQuery}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            title="Open processes page (client hint)"
          >
            Open processes
          </a>
          <span className="text-xs text-slate-500">
            bridges use query hint only; pages may ignore it
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Next action</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{nextAction}</div>
            <div className="mt-1 text-xs text-slate-600">
              process: {selectedProcess ? safeStr(selectedProcess.period || "-") : "none"}
              {" · "}
              profile: {selectedProcess ? safeStr(selectedProcess.profile_code || selectedProcess.profile_id || "-") : "-"}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-slate-500">Risk</div>
            <div className="mt-1">
              {(risk.hasRisk || tasksOverdue > 0) ? (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 ring-1 ring-red-200">
                  risk
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                  ok
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-600">
              overdue tasks: <span className="font-semibold text-slate-900">{tasksOverdue}</span>
            </div>
            <div className="text-xs text-slate-600">
              due today: <span className="font-semibold text-slate-900">{tasksToday}</span>
            </div>
            <div className="text-xs text-slate-600">
              overdue steps: <span className="font-semibold text-slate-900">{risk.overdueSteps}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</div>
          {patchStatus && <div className="text-xs text-slate-600">patch: {patchStatus}</div>}
        </div>

        {selectedTasks.length === 0 && (
          <div className="text-sm text-slate-600">No tasks for this client.</div>
        )}

        {selectedTasks.length > 0 && (
          <div className="space-y-2">
            {selectedTasks.slice(0, 30).map((t, idx) => {
              const st = normalizeStatus(t.computed_status || t.status);
              const isClosed = st === "closed";
              const due = safeStr(t.due_date || t.deadline || t.target_date);
              const overdue = isOverdue(due, isClosed);
              const today = isToday(due, isClosed);
              const title = stripNumberPrefix(t.title || t.name || "Task");
              const taskId = safeStr(t.id || t.task_id || t.key || String(idx));

              const box =
                overdue
                  ? "bg-red-50 ring-1 ring-red-200"
                  : today
                  ? "bg-amber-50 ring-1 ring-amber-200"
                  : isClosed
                  ? "bg-emerald-50 ring-1 ring-emerald-200"
                  : "bg-white ring-1 ring-slate-200";

              return (
                <div key={taskId} className={"rounded-lg p-3 " + box}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200">
                          {st}
                        </span>
                        {due && <span className="text-slate-500">due: {due}</span>}
                        {overdue && <span className="text-red-700 font-medium">overdue</span>}
                        {today && <span className="text-amber-700 font-medium">today</span>}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {st !== "closed" && (
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => patchTask(taskId, { status: "completed" })}
                        >
                          Complete
                        </button>
                      )}
                      {st === "closed" && (
                        <button
                          type="button"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          onClick={() => patchTask(taskId, { status: "open" })}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {selectedTasks.length > 30 && (
              <div className="text-xs text-slate-500">Showing first 30 tasks.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReglementPage;