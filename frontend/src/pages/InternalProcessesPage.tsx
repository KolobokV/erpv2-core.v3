// InternalProcessesPage.tsx — navigation to Tasks Dashboard and Client Profile
// + monthly scheduler UI

import React, { useEffect, useState } from "react";
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

type SchedulerResult = {
  status?: string;
  target_period?: string;
  definitions_considered?: number;
  clients_considered?: number;
  instances_created?: number;
  instances_skipped_existing?: number;
  generate_tasks?: boolean;
  tasks_generated?: number;
  [key: string]: any;
};

const InternalProcessesPage: React.FC = () => {
  const navigate = useNavigate();

  const [defs, setDefs] = useState<ProcessDefinition[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<
    ProcessInstance | null
  >(null);
  const [tasksForInstance, setTasksForInstance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState<
    SchedulerResult | null
  >(null);

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

  const handleRun = async (inst: ProcessInstance) => {
    try {
      setLoading(true);
      setErr(null);

      // backend endpoint is /generate-tasks, not /run
      const res = await fetch(
        `/api/internal/process-instances/${inst.id}/generate-tasks`,
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

  const handleViewTasks = async (inst: ProcessInstance) => {
    try {
      setLoading(true);
      setErr(null);

      setSelectedInstance(inst);
      const res = await fetch(
        `/api/internal/process-instances/${inst.id}/tasks`
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

  const openTasksDashboard = (inst: ProcessInstance) => {
    if (typeof window === "undefined") return;

    try {
      const payload = {
        clientId: inst.client_id || "",
        processId: inst.definition_id,
        instanceId: inst.id,
      };
      window.localStorage.setItem(TASKS_FOCUS_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }

    // navigate to tasks page
    navigate("/tasks");
  };

  const openClientProfile = (inst: ProcessInstance) => {
    if (typeof window === "undefined") return;

    try {
      const payload = {
        clientId: inst.client_id || "",
        month: inst.month || "",
      };
      window.localStorage.setItem(
        CLIENT_PROFILE_FOCUS_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // ignore storage errors
    }

    // navigate to client profile page
    navigate("/client-profile");
  };

  const runScheduler = async (withTasks: boolean) => {
    try {
      setSchedulerLoading(true);
      setErr(null);

      const body = JSON.stringify({
        generate_tasks: withTasks,
      });

      const res = await fetch("/api/internal/scheduler/run-monthly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (!res.ok) {
        throw new Error(`Scheduler failed: ${res.status}`);
      }

      const json = await res.json();
      setSchedulerResult(json);
      await loadAll();
    } catch (e: any) {
      setErr(e.message || "Failed to run monthly scheduler");
    } finally {
      setSchedulerLoading(false);
    }
  };

  const renderSchedulerSummary = () => {
    if (!schedulerResult) return null;

    const root: any = schedulerResult;
    const nested = root.result ?? {};

    const status: string =
      root.status ?? nested.status ?? "unknown";

    const targetPeriod: string =
      root.target_period ??
      nested.target_period ??
      nested.period ??
      nested.target_month ??
      "n/a";

    const definitionsConsidered: number =
      root.definitions_considered ??
      nested.definitions_considered ??
      0;

    const clientsConsidered: number =
      root.clients_considered ??
      nested.clients_considered ??
      0;

    const instancesCreated: number =
      root.instances_created ??
      nested.instances_created ??
      (Array.isArray(nested.created)
        ? nested.created.length
        : nested.count ?? 0);

    const instancesSkipped: number =
      root.instances_skipped_existing ??
      nested.instances_skipped_existing ??
      0;

    const generateTasksFlag: boolean =
      root.generate_tasks ??
      nested.generate_tasks ??
      false;

    const tasksGenerated: number =
      root.tasks_generated ??
      nested.tasks_generated ??
      0;

    return (
      <div className="mt-3 text-xs text-gray-700 space-y-1">
        <div className="font-semibold text-gray-800">
          Last run: status {status}
        </div>
        <div className="flex flex-wrap gap-3">
          <span>
            Period:{" "}
            <span className="font-mono font-semibold">
              {targetPeriod}
            </span>
          </span>
          <span>
            Definitions:{" "}
            <span className="font-semibold">
              {definitionsConsidered}
            </span>
          </span>
          <span>
            Clients:{" "}
            <span className="font-semibold">
              {clientsConsidered}
            </span>
          </span>
          <span>
            Instances created:{" "}
            <span className="font-semibold">
              {instancesCreated}
            </span>
          </span>
          <span>
            Instances skipped:{" "}
            <span className="font-semibold">
              {instancesSkipped}
            </span>
          </span>
          <span>
            Generate tasks:{" "}
            <span className="font-semibold">
              {generateTasksFlag ? "yes" : "no"}
            </span>
          </span>
          <span>
            Tasks generated:{" "}
            <span className="font-semibold">
              {tasksGenerated}
            </span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Internal processes
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Definitions, instances, auto-generated tasks and monthly scheduler.
          </p>
        </div>
        {loading && (
          <div className="text-xs text-gray-500">Loading data...</div>
        )}
      </header>

      {err && (
        <div className="border border-red-300 bg-red-50 text-red-800 text-xs px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">
              Monthly scheduler
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Creates process instances for the target month based on
              definitions. Optionally generates tasks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              disabled={schedulerLoading}
              onClick={() => runScheduler(false)}
              className={
                "px-3 py-1.5 rounded-md border text-xs " +
                (schedulerLoading
                  ? "bg-gray-100 text-gray-400 border-gray-200"
                  : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200")
              }
            >
              {schedulerLoading
                ? "Running..."
                : "Run scheduler (instances only)"}
            </button>
            <button
              type="button"
              disabled={schedulerLoading}
              onClick={() => runScheduler(true)}
              className={
                "px-3 py-1.5 rounded-md border text-xs " +
                (schedulerLoading
                  ? "bg-blue-300 text-white border-blue-300"
                  : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700")
              }
            >
              {schedulerLoading
                ? "Running with tasks..."
                : "Run scheduler + generate tasks"}
            </button>
          </div>
        </div>
        {renderSchedulerSummary()}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col max-h-[540px]">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Process instances
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                One row per client / month / process definition.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadAll()}
              className="px-2 py-1 rounded-md border border-gray-300 bg-white text-xs hover:bg-gray-50"
            >
              Reload
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {instances.length === 0 ? (
              <div className="px-4 py-6 text-xs text-gray-500">
                No process instances found yet. Use monthly scheduler or create
                instances manually.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-[11px] text-gray-500">
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Process</th>
                    <th className="px-3 py-2 text-left">Month</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Created</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst) => {
                    const def = defs.find((d) => d.id === inst.definition_id);
                    const processName =
                      def?.name || inst.definition_name || inst.definition_id;
                    const clientLabel = inst.client_id || "no client";
                    const monthLabel = inst.month || "n/a";

                    return (
                      <tr
                        key={inst.id}
                        className={
                          "border-b border-gray-100 hover:bg-gray-50 cursor-pointer" +
                          (selectedInstance && selectedInstance.id === inst.id
                            ? " bg-blue-50"
                            : "")
                        }
                        onClick={() => setSelectedInstance(inst)}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="text-xs font-medium text-gray-900">
                            {clientLabel}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-xs text-gray-800">
                            {processName}
                          </div>
                          {inst.last_run_result && (
                            <div className="mt-0.5 text-[10px] text-gray-500 truncate max-w-[200px]">
                              Last run: {inst.last_run_result}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="font-mono text-xs text-gray-800">
                            {monthLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-300 text-[11px] text-gray-700">
                            {inst.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-[10px] text-gray-500">
                            {inst.created_at || ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRun(inst);
                              }}
                              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-[11px] hover:bg-gray-50"
                            >
                              Run
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewTasks(inst);
                              }}
                              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-[11px] hover:bg-gray-50"
                            >
                              View tasks
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTasksDashboard(inst);
                              }}
                              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-[11px] hover:bg-gray-50"
                            >
                              Open in Tasks
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openClientProfile(inst);
                              }}
                              className="px-2 py-0.5 rounded border border-gray-300 bg-white text-[11px] hover:bg-gray-50"
                            >
                              Open client profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col max-h-[540px]">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">
              Tasks for selected instance
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Auto-generated tasks linked to internal process instance.
            </p>
            {selectedInstance && (
              <div className="mt-1 text-[11px] text-gray-600 flex flex-wrap gap-3">
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
                    {selectedInstance.status}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!selectedInstance ? (
              <div className="px-4 py-6 text-xs text-gray-500">
                Select an instance on the left to see related tasks.
              </div>
            ) : tasksForInstance.length === 0 ? (
              <div className="px-4 py-6 text-xs text-gray-500">
                No tasks found for this instance yet.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 text-xs">
                {tasksForInstance.map((t: any) => {
                  const title = t.title ?? t.name ?? "(no title)";
                  const status = (t.status ?? "unknown").toString();
                  const deadline = t.deadline ?? t.due_date ?? null;
                  const isDone =
                    status.toLowerCase() === "done" ||
                    status.toLowerCase() === "completed";

                  return (
                    <li key={t.id ?? Math.random()} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-900">
                            {title}
                          </div>
                          {t.description && (
                            <div className="mt-0.5 text-[11px] text-gray-600">
                              {t.description}
                            </div>
                          )}
                          <div className="mt-0.5 text-[11px] text-gray-500 flex flex-wrap gap-3">
                            {t.id && (
                              <span className="font-mono text-gray-500">
                                id: {t.id}
                              </span>
                            )}
                            {deadline && (
                              <span>
                                Deadline:{" "}
                                <span className="font-mono text-gray-800">
                                  {deadline}
                                </span>
                              </span>
                            )}
                            {t.assigned_to && (
                              <span>
                                Assignee:{" "}
                                <span className="font-medium text-gray-800">
                                  {t.assigned_to}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={
                            "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] " +
                            (isDone
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-gray-50 border-gray-200 text-gray-700")
                          }
                        >
                          {status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default InternalProcessesPage;
