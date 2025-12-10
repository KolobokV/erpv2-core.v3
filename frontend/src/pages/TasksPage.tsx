import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Task = {
  id?: string;
  title?: string;
  description?: string;
  client_code?: string;
  client_id?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  event_id?: string;
  [key: string]: any;
};

type TasksResponse =
  | Task[]
  | {
      tasks?: Task[];
      items?: Task[];
      [key: string]: any;
    }
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

type DeadlineSeverity = "none" | "ok" | "soon" | "overdue";

function getDeadlineSeverity(deadline?: string): DeadlineSeverity {
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

function getDeadlineClasses(severity: DeadlineSeverity): string {
  if (severity === "overdue") return "text-red-700 font-semibold";
  if (severity === "soon") return "text-amber-700 font-semibold";
  if (severity === "ok") return "text-slate-800";
  return "text-slate-500";
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const TasksPage: React.FC = () => {
  const query = useQuery();
  const clientFromQuery = query.get("client_code") || query.get("client_id") || "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientFilter, setClientFilter] = useState<string>(clientFromQuery);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [textFilter, setTextFilter] = useState<string>("");
  const [onlyOverdue, setOnlyOverdue] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/tasks");
        if (!resp.ok) {
          throw new Error("Failed to load tasks: " + resp.status);
        }
        const json: TasksResponse = await resp.json();
        if (!mounted) return;
        setTasks(extractTasks(json));
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Unknown error");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const clientCode = (t.client_code || t.client_id || "").toString();

      if (clientFilter && !clientCode.toLowerCase().includes(clientFilter.toLowerCase())) {
        return false;
      }

      if (statusFilter) {
        const st = getStatusKey(t.status);
        if (st !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      if (textFilter) {
        const text = (
          (t.title || "") +
          " " +
          (t.description || "") +
          " " +
          clientCode
        ).toLowerCase();
        if (!text.includes(textFilter.toLowerCase())) {
          return false;
        }
      }

      if (onlyOverdue) {
        const severity = getDeadlineSeverity(t.deadline);
        const st = getStatusKey(t.status);
        if (
          severity !== "overdue" ||
          st === "done" ||
          st === "completed" ||
          st === "closed"
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, clientFilter, statusFilter, textFilter, onlyOverdue]);

  const stats = useMemo(() => {
    const total = tasks.length;
    let newCount = 0;
    let inProgress = 0;
    let done = 0;
    let overdue = 0;

    for (const t of tasks) {
      const st = getStatusKey(t.status);
      if (st === "new") newCount += 1;
      else if (st === "in_progress" || st === "in-progress" || st === "open") {
        inProgress += 1;
      } else if (st === "done" || st === "completed" || st === "closed") {
        done += 1;
      }

      const severity = getDeadlineSeverity(t.deadline);
      if (
        severity === "overdue" &&
        st !== "done" &&
        st !== "completed" &&
        st !== "closed"
      ) {
        overdue += 1;
      }
    }

    return { total, newCount, inProgress, done, overdue };
  }, [tasks]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-600">
            All tasks from /api/tasks with client and status filters. Supports client_code in query string.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <div className="text-slate-500">Total</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-sky-700">New</div>
          <div className="mt-1 text-lg font-semibold text-sky-900">
            {stats.newCount}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-amber-700">In progress</div>
          <div className="mt-1 text-lg font-semibold text-amber-900">
            {stats.inProgress}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-emerald-700">Done</div>
          <div className="mt-1 text-lg font-semibold text-emerald-900">
            {stats.done}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-red-700">Overdue</div>
          <div className="mt-1 text-lg font-semibold text-red-900">
            {stats.overdue}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs shadow-sm">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">
              Client filter
            </label>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1"
              placeholder="client code or id..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">
              Status
            </label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-600">
              Search text
            </label>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1"
              placeholder="title, description..."
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 md:justify-end">
            <label className="flex items-center gap-1 text-[11px] text-slate-700">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
              />
              Only overdue
            </label>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading tasks...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No tasks for current filters.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Tasks list
            </h2>
            <span className="text-[11px] text-slate-500">
              {filtered.length} tasks
            </span>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[110px]">
                    Status
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium">
                    Task
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[140px]">
                    Client
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[130px]">
                    Deadline
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[110px]">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, index) => {
                  const status = t.status || "new";
                  const statusClasses = getStatusBadgeClasses(status);
                  const statusLabel = getStatusLabel(status);
                  const client = (t.client_code || t.client_id || "-").toString();
                  const severity = getDeadlineSeverity(t.deadline);
                  const deadlineClasses = getDeadlineClasses(severity);
                  const deadlineFormatted = formatDate(t.deadline || undefined);
                  const rowStripe =
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                  const detailUrl = `/task-detail?task_id=${encodeURIComponent(
                    t.id || ""
                  )}&client_code=${encodeURIComponent(client)}${
                    t.event_id
                      ? `&event_id=${encodeURIComponent(
                          t.event_id.toString()
                        )}`
                      : ""
                  }`;

                  return (
                    <tr key={t.id || index} className={rowStripe}>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <span
                          className={
                            "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            statusClasses
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <div
                          className="truncate font-medium text-slate-900"
                          title={t.title || ""}
                        >
                          {t.title || t.id || "Task"}
                        </div>
                        {t.description && (
                          <div className="truncate text-[11px] text-slate-500">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <div className="truncate text-slate-800" title={client}>
                          {client}
                        </div>
                      </td>
                      <td
                        className={
                          "border-b border-slate-100 px-2 py-1.5 align-middle " +
                          deadlineClasses
                        }
                      >
                        {deadlineFormatted}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <Link
                          to={detailUrl}
                          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
