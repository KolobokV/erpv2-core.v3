import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Task = {
  id?: string;
  title?: string;
  description?: string;
  client_code?: string;
  client_id?: string;
  client_label?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  event_id?: string;
  [key: string]: any;
};

type ControlEvent = {
  id?: string;
  event_id?: string;
  client_code?: string;
  client_id?: string;
  period?: string;
  status?: string;
  title?: string;
  deadline?: string;
  [key: string]: any;
};

type ProcessInstance = {
  id?: string;
  client_code?: string;
  client_id?: string;
  period?: string;
  status?: string;
  computed_status?: string;
  label?: string;
  [key: string]: any;
};

type TasksResponse =
  | Task[]
  | { tasks?: Task[]; items?: Task[]; [key: string]: any }
  | null
  | undefined;

type EventsResponse =
  | ControlEvent[]
  | { events?: ControlEvent[]; items?: ControlEvent[]; [key: string]: any }
  | null
  | undefined;

type InstancesResponse =
  | ProcessInstance[]
  | { instances?: ProcessInstance[]; items?: ProcessInstance[]; [key: string]: any }
  | null
  | undefined;

function useQuery(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

function extractTasks(data: TasksResponse): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).tasks)) return (data as any).tasks as Task[];
  if (Array.isArray((data as any).items)) return (data as any).items as Task[];
  return [];
}

function extractEvents(data: EventsResponse): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).events)) return (data as any).events as ControlEvent[];
  if (Array.isArray((data as any).items)) return (data as any).items as ControlEvent[];
  return [];
}

function extractInstances(data: InstancesResponse): ProcessInstance[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).instances)) {
    return (data as any).instances as ProcessInstance[];
  }
  if (Array.isArray((data as any).items)) return (data as any).items as ProcessInstance[];
  return [];
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function getStatusKey(status?: string): string {
  return (status || "").toLowerCase();
}

function getStatusBadgeClasses(status?: string): string {
  const s = getStatusKey(status);
  if (s === "new") return "bg-sky-50 text-sky-800 border-sky-200";
  if (s === "in_progress" || s === "in-progress" || s === "open") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (s === "done" || s === "completed" || s === "closed") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (s === "error" || s === "failed") {
    return "bg-red-50 text-red-800 border-red-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getStatusLabel(status?: string): string {
  const s = getStatusKey(status);
  if (!s) return "-";
  if (s === "in_progress" || s === "in-progress") return "in progress";
  return s;
}

function getDeadlineSeverity(deadline?: string): "none" | "ok" | "soon" | "overdue" {
  if (!deadline) return "none";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "none";
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "ok";
}

function getDeadlineClasses(severity: "none" | "ok" | "soon" | "overdue"): string {
  if (severity === "overdue") return "text-red-700 font-semibold";
  if (severity === "soon") return "text-amber-700 font-semibold";
  if (severity === "ok") return "text-slate-800";
  return "text-slate-500";
}

function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

const TaskDetailPage: React.FC = () => {
  const query = useQuery();
  const taskId = query.get("task_id") || "";
  const eventIdFromQuery = query.get("event_id") || "";
  const clientCodeFromQuery = query.get("client_code") || "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksResp, eventsResp, instancesResp] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/internal/control-events/"),
          fetch("/api/internal/process-instances-v2/"),
        ]);

        if (!tasksResp.ok) {
          throw new Error("Failed to load tasks: " + tasksResp.status);
        }
        if (!eventsResp.ok) {
          throw new Error("Failed to load control events: " + eventsResp.status);
        }
        if (!instancesResp.ok) {
          throw new Error("Failed to load process instances: " + instancesResp.status);
        }

        const tasksJson: TasksResponse = await tasksResp.json();
        const eventsJson: EventsResponse = await eventsResp.json();
        const instancesJson: InstancesResponse = await instancesResp.json();

        if (!isMounted) return;

        setTasks(extractTasks(tasksJson));
        setEvents(extractEvents(eventsJson));
        setInstances(extractInstances(instancesJson));
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || "Failed to load task context");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  const task = useMemo(() => {
    if (!taskId || tasks.length === 0) return undefined;
    const target = tasks.find((t) => String(t.id) === String(taskId));
    return target;
  }, [taskId, tasks]);

  const clientCode = useMemo(() => {
    if (clientCodeFromQuery) return clientCodeFromQuery;
    if (task && (task.client_code || task.client_id)) {
      return String(task.client_code || task.client_id);
    }
    return "";
  }, [clientCodeFromQuery, task]);

  const relatedEvent = useMemo(() => {
    if (!events || events.length === 0) return undefined;

    if (eventIdFromQuery) {
      const byQuery = events.find(
        (ev) =>
          String(ev.id) === eventIdFromQuery ||
          String(ev.event_id) === eventIdFromQuery
      );
      if (byQuery) return byQuery;
    }

    if (task && task.event_id) {
      const fromTask = events.find(
        (ev) =>
          String(ev.id) === String(task.event_id) ||
          String(ev.event_id) === String(task.event_id)
      );
      if (fromTask) return fromTask;
    }

    if (clientCode) {
      const byClient = events.find(
        (ev) =>
          String(ev.client_code || ev.client_id || "") === clientCode
      );
      return byClient;
    }

    return undefined;
  }, [events, eventIdFromQuery, task, clientCode]);

  const relatedInstances = useMemo(() => {
    if (!instances || instances.length === 0 || !clientCode) return [];
    const filtered = instances.filter(
      (inst) =>
        String(inst.client_code || inst.client_id || "") === clientCode
    );
    filtered.sort((a, b) => {
      const pa = String(a.period || "");
      const pb = String(b.period || "");
      if (pa < pb) return -1;
      if (pa > pb) return 1;
      return 0;
    });
    return filtered.slice(-5).reverse();
  }, [instances, clientCode]);

  const taskStatusClasses = getStatusBadgeClasses(task?.status);
  const taskStatusLabel = getStatusLabel(task?.status);
  const taskDeadlineSeverity = getDeadlineSeverity(task?.deadline);
  const taskDeadlineClasses = getDeadlineClasses(taskDeadlineSeverity);
  const taskDeadlineFormatted = formatDate(task?.deadline);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Task detail</h1>
          <p className="text-sm text-slate-600">
            Single task view with related control event and recent processes for the client.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/tasks"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
          >
            Back to tasks
          </Link>
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading task context...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !task && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Task with id "{taskId}" not found in /api/tasks.
        </div>
      )}

      {task && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Task main info */}
          <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {task.title || task.id || "Task"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Task ID: {task.id || "-"}
                </div>
                {clientCode && (
                  <div className="text-[11px] text-slate-500">
                    Client: {clientCode}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div>
                  <span
                    className={
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                      taskStatusClasses
                    }
                  >
                    {taskStatusLabel}
                  </span>
                </div>
                <div className={"mt-1 text-xs " + taskDeadlineClasses}>
                  Deadline: {taskDeadlineFormatted}
                </div>
                {task.priority && (
                  <div className="mt-1 text-[11px] text-slate-700">
                    Priority:{" "}
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5">
                      {task.priority}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {task.description && (
              <div className="mt-2 rounded-md bg-slate-50 px-2 py-2 text-xs text-slate-700">
                {task.description}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div>
                Event id: {task.event_id ? String(task.event_id) : "-"}
              </div>
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                {showRaw ? "Hide raw payload" : "Show raw payload"}
              </button>
            </div>

            {showRaw && (
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 px-3 py-2 text-[11px] text-slate-100">
                {formatJson(task)}
              </pre>
            )}
          </div>

          {/* Related event */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Related control event
              </div>
              <Link
                to="/control-events"
                className="text-[11px] font-medium text-slate-600 hover:text-slate-800"
              >
                Open events page
              </Link>
            </div>

            {!relatedEvent && (
              <div className="text-xs text-slate-500">
                No matching control event found.
              </div>
            )}

            {relatedEvent && (
              <div className="space-y-1 text-xs">
                <div className="font-medium text-slate-900">
                  {relatedEvent.title || relatedEvent.id || relatedEvent.event_id}
                </div>
                <div className="text-[11px] text-slate-500">
                  Event ID: {relatedEvent.event_id || relatedEvent.id || "-"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Client:{" "}
                  {String(
                    relatedEvent.client_code ||
                      relatedEvent.client_id ||
                      clientCode ||
                      "-"
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Period: {relatedEvent.period || "-"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: {relatedEvent.status || "-"}
                </div>
                {relatedEvent.deadline && (
                  <div className="text-[11px] text-slate-500">
                    Deadline: {formatDate(relatedEvent.deadline)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent processes for client */}
      {clientCode && relatedInstances.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Recent processes for client
              </div>
              <div className="text-[11px] text-slate-500">
                Client: {clientCode} · last {relatedInstances.length} instances
              </div>
            </div>
            <Link
              to="/client-process-overview"
              className="text-[11px] font-medium text-slate-600 hover:text-slate-800"
            >
              Open process overview
            </Link>
          </div>

          <div className="max-h-60 overflow-auto rounded-lg border border-slate-100">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-100 px-2 py-1 text-left font-medium w-[110px]">
                    Period
                  </th>
                  <th className="border-b border-slate-100 px-2 py-1 text-left font-medium">
                    Label
                  </th>
                  <th className="border-b border-slate-100 px-2 py-1 text-left font-medium w-[120px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {relatedInstances.map((inst, index) => {
                  const status = inst.computed_status || inst.status || "-";
                  const statusLabel = getStatusLabel(status);
                  const statusClasses = getStatusBadgeClasses(status);
                  const rowStripe =
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                  return (
                    <tr key={inst.id || inst.period || index} className={rowStripe}>
                      <td className="border-b border-slate-100 px-2 py-1 align-middle">
                        {String(inst.period || "-")}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 align-middle">
                        <div className="truncate" title={String(inst.label || "")}>
                          {inst.label || inst.id || "-"}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1 align-middle">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            statusClasses
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clientCode && relatedInstances.length === 0 && !loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          No process instances found for client {clientCode}.
        </div>
      )}
    </div>
  );
};

export default TaskDetailPage;
