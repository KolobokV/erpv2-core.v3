import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const CLIENT_PROFILE_FOCUS_KEY = "erpv2_client_profile_focus";
const TASKS_FOCUS_KEY = "erpv2_tasks_focus";

type ProcessDefinition = {
  id: string;
  name: string;
  description?: string;
};

type ProcessInstance = {
  id: string;
  definition_id: string;
  definition_name?: string;
  client_id?: string;
  profile_code?: string;
  period?: string;
  status: string;
  computed_status?: string;
  created_at?: string;
  updated_at?: string;
  source?: string;
  events?: string[];
  last_event_code?: string | null;
  steps?: ProcessInstanceStep[];
};

type ProcessInstanceStep = {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  completed_at?: string | null;
};

type ProcessStatusSummary = {
  total: number;
  open: number;
  waiting: number;
  completed: number;
  error: number;
  other: number;
};

type TasksSummary = {
  total: number;
  completed: number;
  overdue: number;
  planned: number;
  derivedStatus: string;
};

type TasksListResponse = {
  items: any[];
};

type ProcessDefinitionMap = Record<string, ProcessDefinition>;

const statusOrder = ["open", "waiting", "completed", "error", "other"];

function normalizeStatus(status: string | undefined | null): string {
  if (!status) return "other";
  const s = status.toLowerCase();
  if (s === "open") return "open";
  if (s === "waiting") return "waiting";
  if (s === "completed") return "completed";
  if (s === "error") return "error";
  return "other";
}

function getStatusLabel(status: string): string {
  const s = normalizeStatus(status);
  switch (s) {
    case "open":
      return "Open";
    case "waiting":
      return "Waiting";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    default:
      return status || "other";
  }
}

function getStatusBadgeClasses(status: string): string {
  const s = normalizeStatus(status);
  switch (s) {
    case "open":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "waiting":
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    case "completed":
      return "bg-green-100 text-green-800 border border-green-200";
    case "error":
      return "bg-red-100 text-red-800 border border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border border-gray-200";
  }
}

function getStatusDotClasses(status: string): string {
  const s = normalizeStatus(status);
  switch (s) {
    case "open":
      return "bg-blue-500";
    case "waiting":
      return "bg-yellow-500";
    case "completed":
      return "bg-green-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function buildStatusSummary(instances: ProcessInstance[]): ProcessStatusSummary {
  const summary: ProcessStatusSummary = {
    total: 0,
    open: 0,
    waiting: 0,
    completed: 0,
    error: 0,
    other: 0,
  };

  for (const inst of instances) {
    summary.total += 1;
    const s = normalizeStatus(inst.computed_status || inst.status);
    if (s in summary) {
      // @ts-ignore
      summary[s] += 1;
    } else {
      summary.other += 1;
    }
  }

  return summary;
}

function deriveTasksSummary(tasks: any[]): TasksSummary {
  let total = tasks.length;
  let completed = 0;
  let overdue = 0;
  let planned = 0;

  for (const t of tasks) {
    const status = String(t.status || "").toLowerCase();
    if (status === "done" || status === "completed") {
      completed++;
    } else if (status === "overdue") {
      overdue++;
    } else if (status === "planned" || status === "new") {
      planned++;
    }
  }

  let derivedStatus = "no-tasks";
  if (total === 0) {
    derivedStatus = "no-tasks";
  } else if (completed === total && overdue === 0) {
    derivedStatus = "completed-by-tasks";
  } else if (overdue > 0) {
    derivedStatus = "has-overdue-tasks";
  }

  return {
    total,
    completed,
    overdue,
    planned,
    derivedStatus,
  };
}

const InternalProcessesPage: React.FC = () => {
  const navigate = useNavigate();

  const [defs, setDefs] = useState<ProcessDefinition[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<ProcessInstance | null>(
    null
  );
  const [tasksForInstance, setTasksForInstance] = useState<any[]>([]);
  const [lifecycleSyncInProgress, setLifecycleSyncInProgress] = useState(false);
  const [lifecycleSyncError, setLifecycleSyncError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ===== CHAIN DEBUG TRIGGER STATE =====
  const [chainId, setChainId] = useState("debug.log");
  const [chainClient, setChainClient] = useState("");
  const [chainContext, setChainContext] = useState("{}");
  const [chainResult, setChainResult] = useState<string | null>(null);

  const [clientFilter, setClientFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const defsMap: ProcessDefinitionMap = useMemo(() => {
    const m: ProcessDefinitionMap = {};
    for (const d of defs) {
      m[d.id] = d;
    }
    return m;
  }, [defs]);

  const summary: ProcessStatusSummary = useMemo(
    () => buildStatusSummary(instances),
    [instances]
  );

  const filteredInstances = useMemo(() => {
    let data = [...instances];

    if (clientFilter.trim()) {
      const cf = clientFilter.trim().toLowerCase();
      data = data.filter((inst) =>
        (inst.client_id || "")
          .toString()
          .toLowerCase()
          .includes(cf)
      );
    }

    if (statusFilter !== "all") {
      data = data.filter((inst) => {
        const s = normalizeStatus(inst.computed_status || inst.status);
        return s === statusFilter;
      });
    }

    data.sort((a, b) => {
      const sa = normalizeStatus(a.computed_status || a.status);
      const sb = normalizeStatus(b.computed_status || b.status);
      const ia = statusOrder.indexOf(sa);
      const ib = statusOrder.indexOf(sb);
      if (ia !== ib) return ia - ib;
      return (a.client_id || "").localeCompare(b.client_id || "");
    });

    return data;
  }, [instances, clientFilter, statusFilter]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setErr(null);

      const [defsRes, instRes] = await Promise.all([
        fetch("/api/internal/process-definitions"),
        fetch("/api/internal/process-instances-v2"),
      ]);

      if (!defsRes.ok) throw new Error("Failed to load process definitions");
      if (!instRes.ok) throw new Error("Failed to load process instances");

      const defsJson = await defsRes.json();
      const instJson = await instRes.json();

      setDefs(Array.isArray(defsJson) ? defsJson : defsJson.items ?? []);
      setInstances(Array.isArray(instJson) ? instJson : instJson.items ?? []);
    } catch (e: any) {
      setErr(e.message || "Failed to load internal processes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSelectInstance = (inst: ProcessInstance) => {
    setSelectedInstance(inst);
    loadTasksForInstance(inst);
  };

  const loadTasksForInstance = async (inst: ProcessInstance) => {
    setTasksForInstance([]);
    if (!inst || !inst.client_id) return;

    try {
      const params = new URLSearchParams();
      params.append("client_id", inst.client_id);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) return;

      const json = (await res.json()) as TasksListResponse;
      const items = Array.isArray(json) ? json : json.items ?? [];
      setTasksForInstance(items);
    } catch {
      return;
    }
  };

  const handleLifecycleSync = async (inst: ProcessInstance) => {
    if (!inst || !inst.id) return;

    setLifecycleSyncInProgress(true);
    setLifecycleSyncError(null);

    try {
      const res = await fetch(
        `/api/internal/process-overview/client/${encodeURIComponent(
          inst.client_id || ""
        )}?year=${encodeURIComponent(
          (inst.period || "").split("-")[0] || ""
        )}&month=${encodeURIComponent(
          (inst.period || "").split("-")[1] || ""
        )}`,
        {
          method: "GET",
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to sync lifecycle from overview. Status: ${res.status}`
        );
      }

      const updated = await fetch(
        `/api/internal/process-instances-v2/${encodeURIComponent(inst.id)}`,
        {
          method: "GET",
        }
      );

      if (!updated.ok) {
        throw new Error(
          `Lifecycle sync partially succeeded, but failed to reload instance. Status: ${updated.status}`
        );
      }

      const updatedInstance = (await updated.json()) as ProcessInstance;
      setInstances((prev) =>
        prev.map((x) => (x.id === updatedInstance.id ? updatedInstance : x))
      );
      setSelectedInstance(updatedInstance);
      await loadTasksForInstance(updatedInstance);
    } catch (e: any) {
      setLifecycleSyncError(e.message || "Failed to sync lifecycle");
    } finally {
      setLifecycleSyncInProgress(false);
    }
  };

  const handleOpenClientProfile = (inst: ProcessInstance) => {
    if (!inst || !inst.client_id) return;

    try {
      window.localStorage.setItem(
        CLIENT_PROFILE_FOCUS_KEY,
        JSON.stringify({
          client_id: inst.client_id,
          profile_code: inst.profile_code || null,
        })
      );
    } catch {
      // ignore
    }

    navigate("/client-profile");
  };

  const handleOpenTasksForClient = (inst: ProcessInstance) => {
    if (!inst || !inst.client_id) return;

    try {
      window.localStorage.setItem(
        TASKS_FOCUS_KEY,
        JSON.stringify({
          client_id: inst.client_id,
          profile_code: inst.profile_code || null,
        })
      );
    } catch {
      // ignore
    }

    navigate("/tasks");
  };

  return (
    <div className="flex h-full flex-col gap-3 px-6 py-4 text-xs text-gray-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Internal processes
          </h1>
          <p className="max-w-3xl text-xs text-gray-500">
            Process instances built from control events and stored in JSON backend store.
            Use this view to see which clients have active processes, their statuses and steps,
            and how they relate to tasks and overview.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />{" "}
              <span className="text-gray-600">Open</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />{" "}
              <span className="text-gray-600">Waiting</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />{" "}
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />{" "}
              <span className="text-gray-600">Error</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-400" />{" "}
              <span className="text-gray-600">Other</span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] shadow-sm">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-700">Total:</span>
              <span className="text-gray-900">{summary.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span>Open: {summary.open}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <span>Waiting: {summary.waiting}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>Completed: {summary.completed}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>Error: {summary.error}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <span>Other: {summary.other}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4">
        <div className="flex w-3/5 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-600">Client filter</label>
              <input
                type="text"
                className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                placeholder="client_id (optional)"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-600">Status filter</label>
              <select
                className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="waiting">Waiting</option>
                <option value="completed">Completed</option>
                <option value="error">Error</option>
              </select>
            </div>
            <button
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={loadAll}
              disabled={loading}
            >
              {loading ? "Reloading..." : "Reload"}
            </button>
          </div>

          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-gray-700">
                Process instances
              </div>
              {err && (
                <div className="text-[11px] text-red-600">
                  {err}
                </div>
              )}
            </div>

            <div className="h-[340px] overflow-auto">
              <table className="min-w-full border-separate border-spacing-y-1 px-2">
                <thead>
                  <tr className="text-[11px] text-gray-600">
                    <th className="w-[28px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="w-[140px] px-2 py-1 text-left font-medium">
                      Client
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Profile
                    </th>
                    <th className="w-[70px] px-2 py-1 text-left font-medium">
                      Period
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Process
                    </th>
                    <th className="w-[60px] px-2 py-1 text-right font-medium">
                      Steps
                    </th>
                    <th className="w-[100px] px-2 py-1 text-left font-medium">
                      Last event
                    </th>
                    <th className="w-[80px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="w-[130px] px-2 py-1 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst) => {
                    const isSelected =
                      selectedInstance && selectedInstance.id === inst.id;

                    return (
                      <tr
                        key={inst.id}
                        className={
                          "cursor-pointer rounded-md border border-gray-100 bg-gray-50 text-[11px] text-gray-800 shadow-sm transition hover:bg-blue-50" +
                          (isSelected ? " ring-1 ring-blue-400" : "")
                        }
                        onClick={() => handleSelectInstance(inst)}
                      >
                        <td className="px-2 py-1 align-top">
                          <span
                            className={
                              "inline-block h-2 w-2 rounded-full " +
                              getStatusDotClasses(inst.computed_status || inst.status)
                            }
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="font-medium text-gray-900">
                            {inst.client_id || "n/a"}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {inst.source || "source: n/a"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="text-[11px] text-gray-800">
                            {inst.profile_code || "n/a"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="text-[11px] text-gray-800">
                            {inst.period || "n/a"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="text-[11px] text-gray-800">
                            {inst.definition_name ||
                              inst.definition_id ||
                              "process: n/a"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top text-right">
                          <span className="inline-flex items-center justify-end text-[11px] text-gray-800">
                            {inst.steps ? inst.steps.length : 0}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="text-[11px] text-gray-800">
                            {inst.last_event_code || "n/a"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                              getStatusBadgeClasses(
                                inst.computed_status || inst.status
                              )
                            }
                          >
                            {getStatusLabel(inst.computed_status || inst.status)}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top text-right">
                          <div className="flex flex-col items-end gap-1">
                            <button
                              className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenClientProfile(inst);
                              }}
                            >
                              Open profile
                            </button>
                            <button
                              className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTasksForClient(inst);
                              }}
                            >
                              Tasks
                            </button>
                            <button
                              className="rounded-md border border-blue-400 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 hover:bg-blue-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLifecycleSync(inst);
                              }}
                              disabled={lifecycleSyncInProgress}
                            >
                              {lifecycleSyncInProgress
                                ? "Syncing..."
                                : "Sync lifecycle"}
                            </button>
                            {lifecycleSyncError && isSelected && (
                              <div className="max-w-[180px] text-[10px] text-red-600">
                                {lifecycleSyncError}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {instances.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-3 py-4 text-center text-[11px] text-gray-500"
                      >
                        No process instances found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex w-2/5 flex-col gap-2">
          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-700">
              Process steps
            </div>
            <div className="h-[200px] overflow-auto px-3 py-2">
              {selectedInstance && selectedInstance.steps && selectedInstance.steps.length > 0 ? (
                <ul className="space-y-1">
                  {selectedInstance.steps.map((step) => (
                    <li
                      key={step.id}
                      className="flex items-start justify-between rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-[11px]"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {step.title}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Created: {step.created_at || "n/a"}
                          {step.completed_at
                            ? ` | Completed: ${step.completed_at}`
                            : ""}
                        </div>
                      </div>
                      <span
                        className={
                          "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                          getStatusBadgeClasses(step.status)
                        }
                      >
                        {getStatusLabel(step.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[11px] text-gray-500">
                  This instance has no steps yet. Auto-steps will be created by backend
                  when new control events are mapped to this process.
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-700">
              Tasks for selected instance
            </div>
            <div className="h-[140px] overflow-auto px-3 py-2">
              {selectedInstance ? (
                tasksForInstance.length > 0 ? (
                  <ul className="space-y-1">
                    {tasksForInstance.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start justify-between rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-[11px]"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {t.title || "Task"}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Status: {t.status || "n/a"}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[11px] text-gray-500">
                    No tasks found for this instance yet.
                  </div>
                )
              ) : (
                <div className="text-[11px] text-gray-500">
                  Select a process instance on the left to view its tasks.
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-700">
              Chain debug trigger
            </div>
            <div className="space-y-2 px-3 py-2 text-[11px]">
              <div className="flex items-center gap-2">
                <label className="w-[80px] text-gray-600">Chain id</label>
                <input
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={chainId}
                  onChange={(e) => setChainId(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-[80px] text-gray-600">Client</label>
                <input
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  value={chainClient}
                  onChange={(e) => setChainClient(e.target.value)}
                />
              </div>
              <div className="flex items-start gap-2">
                <label className="w-[80px] text-gray-600">Context</label>
                <textarea
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  rows={3}
                  value={chainContext}
                  onChange={(e) => setChainContext(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                  onClick={async () => {
                    setChainResult(null);
                    try {
                      const res = await fetch("/api/internal/chains/trigger", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          chain_id: chainId,
                          client_id: chainClient,
                          context: chainContext,
                        }),
                      });
                      if (!res.ok) {
                        throw new Error(
                          `Failed to trigger chain. Status: ${res.status}`
                        );
                      }
                      const json = await res.json();
                      setChainResult(JSON.stringify(json, null, 2));
                    } catch (e: any) {
                      setChainResult(
                        e.message || "Failed to trigger chain"
                      );
                    }
                  }}
                >
                  Trigger
                </button>
              </div>
              {chainResult && (
                <pre className="max-h-[120px] overflow-auto rounded-md bg-gray-900 p-2 text-[10px] text-green-100">
                  {chainResult}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalProcessesPage;
