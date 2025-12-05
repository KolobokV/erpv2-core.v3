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
  month: string;
  status: string;
  last_run_result?: string;
  created_at?: string;
  client_id?: string;
};

type TasksSummary = {
  total: number;
  completed: number;
  overdue: number;
  planned: number;
  derivedStatus: string;
};

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
  const [chainError, setChainError] = useState<string | null>(null);

  const [chainOptions, setChainOptions] = useState<string[]>([]);

  const tasksSummary = useMemo<TasksSummary>(() => {
    const total = tasksForInstance.length;
    let completed = 0;
    let overdue = 0;
    let planned = 0;

    const completedStatuses = ["done", "completed", "closed", "finished"];

    for (const raw of tasksForInstance) {
      const statusValue = (raw?.status ?? "").toString().toLowerCase();

      if (!statusValue || statusValue === "planned" || statusValue === "new") {
        planned += 1;
        continue;
      }

      if (statusValue === "overdue" || statusValue === "late") {
        overdue += 1;
        continue;
      }

      if (completedStatuses.includes(statusValue)) {
        completed += 1;
      } else {
        planned += 1;
      }
    }

    let derivedStatus = "in-progress";

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
  }, [tasksForInstance]);

  const selectedInstanceLive: ProcessInstance | null = useMemo(() => {
    if (!selectedInstance) return null;
    const found = instances.find((inst) => inst.id === selectedInstance.id);
    return found || selectedInstance;
  }, [selectedInstance, instances]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setErr(null);

      const [defsRes, instRes] = await Promise.all([
        fetch("/api/internal/process-definitions"),
        fetch("/api/internal/process-instances"),
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

  // ===== LOAD REGISTERED CHAINS FOR DEBUG PANEL =====
  useEffect(() => {
    const loadChains = async () => {
      try {
        const res = await fetch("/api/internal/chains/registered");
        if (!res.ok) {
          return;
        }
        const json = await res.json();
        const items = Array.isArray(json) ? json : json.items ?? [];
        const ids: string[] = [];
        for (const item of items) {
          if (item && typeof item.id === "string") {
            ids.push(item.id);
          }
        }
        if (ids.length > 0) {
          setChainOptions(ids);
          if (!chainId) {
            setChainId(ids[0]);
          }
        }
      } catch {
        // silent fail for debug helper
      }
    };

    loadChains();
  }, [chainId]);

  // ===== LIFECYCLE AUTOSYNC FROM TASKS =====
  useEffect(() => {
    if (!selectedInstance) return;
    const live = instances.find((inst) => inst.id === selectedInstance.id);
    if (!live) return;

    if (
      tasksSummary.derivedStatus !== "completed-by-tasks" ||
      live.status === "completed" ||
      lifecycleSyncInProgress
    ) {
      return;
    }

    const controller = new AbortController();

    const doSync = async () => {
      try {
        setLifecycleSyncInProgress(true);
        setLifecycleSyncError(null);

        const res = await fetch(
          `/api/internal/process-instances/${encodeURIComponent(
            live.id
          )}/lifecycle/sync-from-tasks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ derived_status: tasksSummary.derivedStatus }),
            signal: controller.signal,
          }
        );

        if (!res.ok) {
          throw new Error(`Lifecycle sync failed with status ${res.status}`);
        }

        await res.json();
        await loadAll();
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setLifecycleSyncError(error?.message || "Failed to sync lifecycle from tasks.");
      } finally {
        setLifecycleSyncInProgress(false);
      }
    };

    doSync();
    return () => controller.abort();
  }, [selectedInstance, instances, tasksSummary.derivedStatus, lifecycleSyncInProgress]);

  // ===== RUN INSTANCE =====
  const handleRun = async (inst: ProcessInstance) => {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(
        `/api/internal/process-instances/${encodeURIComponent(inst.id)}/generate-tasks`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Failed to generate tasks for instance");

      await loadAll();
      await handleViewTasks(inst);
    } catch (e: any) {
      setErr(e.message || "Failed to run process instance");
    } finally {
      setLoading(false);
    }
  };

  // ===== VIEW TASKS + AUTOFILL CHAIN DEBUG CONTEXT =====
  const handleViewTasks = async (inst: ProcessInstance) => {
    try {
      setLoading(true);
      setErr(null);

      setSelectedInstance(inst);

      const autofillClientId = inst.client_id || "";
      setChainClient(autofillClientId);

      const contextPayload = {
        process_instance_id: inst.id,
        process_definition_id: inst.definition_id,
        process_name: inst.definition_name || inst.definition_id,
        month: inst.month,
        client_id: autofillClientId,
        status: inst.status,
      };

      setChainContext(JSON.stringify(contextPayload, null, 2));

      const res = await fetch(
        `/api/internal/process-instances/${encodeURIComponent(inst.id)}/tasks`
      );

      if (!res.ok) throw new Error("Failed to load tasks for instance");

      const json = await res.json();
      const items = Array.isArray(json) ? json : json.items ?? [];
      setTasksForInstance(items);
    } catch (e: any) {
      setErr(e.message || "Failed to load tasks for instance");
    } finally {
      setLoading(false);
    }
  };

  // ===== NAVIGATION =====
  const handleOpenClientProfile = (inst: ProcessInstance) => {
    try {
      const payload = {
        clientId: inst.client_id || "",
        processId: inst.definition_id,
        instanceId: inst.id,
      };
      window.localStorage.setItem(CLIENT_PROFILE_FOCUS_KEY, JSON.stringify(payload));
    } catch {}
    navigate("/client-profile");
  };

  const handleOpenTasksDashboard = (inst: ProcessInstance) => {
    try {
      const payload = {
        clientId: inst.client_id || "",
        processId: inst.definition_id,
        instanceId: inst.id,
      };
      window.localStorage.setItem(TASKS_FOCUS_KEY, JSON.stringify(payload));
    } catch {}
    navigate("/tasks");
  };

  const hasInstances = instances.length > 0;

  // ===== CHAIN DEBUG TRIGGER ACTION =====
  const handleChainDebug = async () => {
    try {
      setChainError(null);
      setChainResult(null);

      let parsedContext: any = {};

      try {
        parsedContext =
          chainContext.trim() === "" ? {} : JSON.parse(chainContext.trim());
      } catch (e: any) {
        setChainError("Context is not valid JSON");
        return;
      }

      const payload = {
        chain_id: chainId,
        client_id: chainClient || null,
        context: parsedContext,
      };

      const res = await fetch("/api/internal/chains/debug-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      setChainResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setChainError(e.message || "Failed to trigger chain");
    }
  };

  return (
    <div className="flex h-full p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <header className="border-b border-gray-200 pb-2">
          <h1 className="text-base font-semibold text-gray-900">
            Internal processes
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Internal process instances on the left, related tasks in the middle, chain debug on the right.
          </p>
        </header>

        {err && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,380px)_minmax(0,1fr)_280px] gap-3">
          {/* Left column: process instances */}
          <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-800">
                Process instances
              </h2>
              <span className="text-[11px] text-gray-500">
                Total:{" "}
                <span className="font-semibold text-gray-900">
                  {instances.length}
                </span>
              </span>
            </div>

            {!hasInstances ? (
              <div className="mt-2 text-xs text-gray-500">
                No instances found. Use backend scheduler or demo data to create
                them.
              </div>
            ) : (
              <div className="mt-1 min-h-0 flex-1 overflow-auto pr-1">
                <table className="min-w-full border-separate border-spacing-y-[4px] text-xs">
                  <thead className="sticky top-0 bg-white text-[11px] text-gray-500">
                    <tr>
                      <th className="w-[110px] px-2 py-1 text-left font-medium">
                        Client
                      </th>
                      <th className="w-[70px] px-2 py-1 text-left font-medium">
                        Month
                      </th>
                      <th className="px-2 py-1 text-left font-medium">Process</th>
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
                            "cursor-pointer rounded-md border border-gray-100 bg-gray-50 text-[11px] text-gray-800 shadow-sm hover:border-blue-300 hover:bg-blue-50" +
                            (isSelected ? " bg-blue-50 border-blue-300" : "")
                          }
                          onClick={() => handleViewTasks(inst)}
                        >
                          <td className="px-2 py-1 align-top">
                            <span className="font-mono text-[11px] text-gray-900">
                              {inst.client_id || "no-client"}
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="font-mono text-[11px] text-gray-800">
                              {inst.month}
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <div className="text-[11px] text-gray-900">
                              {inst.definition_name || inst.definition_id}
                            </div>
                            {inst.last_run_result && (
                              <div className="mt-0.5 text-[10px] text-gray-500 line-clamp-1">
                                {inst.last_run_result}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span
                              className={
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                (inst.status === "completed"
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : inst.status === "ready"
                                  ? "bg-gray-100 text-gray-800 border border-gray-200"
                                  : "bg-yellow-100 text-yellow-800 border border-yellow-200")
                              }
                            >
                              {inst.status}
                            </span>
                          </td>
                          <td
                            className="px-2 py-1 align-top"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <button
                                type="button"
                                className="inline-flex items-center rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
                                onClick={() => handleRun(inst)}
                              >
                                Run
                              </button>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                                  onClick={() => handleOpenClientProfile(inst)}
                                >
                                  Client
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center rounded border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                                  onClick={() => handleOpenTasksDashboard(inst)}
                                >
                                  Tasks
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Middle column: tasks for selected instance */}
          <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Tasks for selected instance
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Auto-generated tasks linked to internal process instance.
                </p>
                {selectedInstance && (
                  <>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-600">
                      <span>
                        Client:{" "}
                        <span className="font-mono text-gray-900">
                          {selectedInstance.client_id || "no client"}
                        </span>
                      </span>
                      <span>
                        Process:{" "}
                        <span className="font-mono text-gray-900">
                          {selectedInstance.definition_name ||
                            selectedInstance.definition_id}
                        </span>
                      </span>
                      <span>
                        Month:{" "}
                        <span className="font-mono text-gray-900">
                          {selectedInstance.month || "n/a"}
                        </span>
                      </span>
                      <span>
                        Status:{" "}
                        <span className="font-semibold text-gray-900">
                          {selectedInstanceLive?.status ?? selectedInstance.status}
                        </span>
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-600">
                      <span>
                        Tasks:{" "}
                        <span className="font-mono text-gray-900">
                          {tasksSummary.completed} / {tasksSummary.total} completed
                        </span>
                      </span>
                      <span>
                        Overdue:{" "}
                        <span className="font-mono text-gray-900">
                          {tasksSummary.overdue}
                        </span>
                      </span>
                      <span>
                        Derived:{" "}
                        <span className="font-mono text-gray-900">
                          {tasksSummary.derivedStatus}
                        </span>
                      </span>
                      {tasksSummary.derivedStatus === "completed-by-tasks" && (
                        <span>
                          Lifecycle:{" "}
                          <span className="font-mono text-gray-900">
                            auto-sync to "completed"
                            {lifecycleSyncInProgress ? " (syncing...)" : ""}
                          </span>
                        </span>
                      )}
                      {lifecycleSyncError && (
                        <span className="text-red-600">
                          Lifecycle sync error: {lifecycleSyncError}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {!selectedInstance ? (
              <div className="flex-1 px-4 py-6 text-xs text-gray-500">
                Select an instance on the left to see related tasks.
              </div>
            ) : tasksForInstance.length === 0 ? (
              <div className="flex-1 space-y-2 px-4 py-6 text-xs text-gray-500">
                <div>No tasks for this instance.</div>
                <div>
                  Use{" "}
                  <span className="font-mono text-xs">
                    Run
                  </span>{" "}
                  on the instance in the left panel to generate tasks.
                </div>
              </div>
            ) : (
              <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
                <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                  <thead className="text-[11px] text-gray-500">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Title</th>
                      <th className="px-2 py-1 text-left font-medium">Status</th>
                      <th className="px-2 py-1 text-left font-medium">Due</th>
                      <th className="px-2 py-1 text-left font-medium">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasksForInstance.map((task, index) => {
                      const baseKey =
                        (task.id as string) ||
                        (task.internal_id as string) ||
                        "task";
                      const rowKey = `${baseKey}_${index}`;

                      return (
                        <tr
                          key={rowKey}
                          className="rounded-md bg-gray-50 text-[11px] text-gray-800"
                        >
                          <td className="px-2 py-1 align-top">
                            <div className="font-medium text-gray-900">
                              {task.title || "(no title)"}
                            </div>
                            {task.description && (
                              <div className="mt-0.5 text-[10px] text-gray-500 line-clamp-2">
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-[10px]">
                              {task.status || "n/a"}
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <div className="flex flex-col gap-0.5 text-[10px]">
                              <span>
                                {task.due_date ||
                                  task.deadline ||
                                  task.planned_date ||
                                  "n/a"}
                              </span>
                              {task.is_overdue && (
                                <span className="text-[10px] font-semibold text-red-600">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="font-mono text-[10px] text-gray-700">
                              {task.assignee || "unassigned"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Right column: chain debug panel */}
          <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
            <div className="mb-2">
              <div className="text-[11px] font-semibold text-gray-700">
                Chain debug
              </div>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Trigger chains with instance context.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <div className="mb-2">
                <label className="mb-1 block text-[11px] text-gray-600">
                  Chain id
                </label>
                {chainOptions.length > 0 ? (
                  <select
                    value={chainId}
                    onChange={(e) => setChainId(e.target.value)}
                    className="w-full rounded border border-gray-300 px-1 py-0.5 text-[11px] bg-white"
                  >
                    {chainOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={chainId}
                    placeholder="chain_id"
                    onChange={(e) => setChainId(e.target.value)}
                    className="w-full rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                  />
                )}
              </div>

              <div className="mb-2">
                <label className="mb-1 block text-[11px] text-gray-600">
                  Client id (optional)
                </label>
                <input
                  type="text"
                  value={chainClient}
                  placeholder="client_id (optional)"
                  onChange={(e) => setChainClient(e.target.value)}
                  className="w-full rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                />
              </div>

              <div className="mb-2">
                <label className="mb-1 block text-[11px] text-gray-600">
                  Context JSON
                </label>
                <textarea
                  value={chainContext}
                  placeholder="context JSON"
                  onChange={(e) => setChainContext(e.target.value)}
                  className="h-32 w-full rounded border border-gray-300 px-1 py-0.5 text-[11px] font-mono"
                />
              </div>

              <button
                type="button"
                onClick={handleChainDebug}
                className="inline-flex w-full items-center justify-center rounded border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
              >
                Run chain
              </button>

              {chainError && (
                <div className="mt-2 text-[11px] text-red-600 break-words">
                  {chainError}
                </div>
              )}

              {chainResult && (
                <pre className="mt-2 max-h-40 overflow-auto rounded border border-gray-200 bg-gray-50 p-1 text-[11px] text-gray-700">
                  {chainResult}
                </pre>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default InternalProcessesPage;
