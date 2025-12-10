import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

type TasksResponse =
  | Task[]
  | { tasks?: Task[]; items?: Task[]; [key: string]: any }
  | null
  | undefined;

function extractTasks(data: TasksResponse): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).tasks)) return (data as any).tasks as Task[];
  if (Array.isArray((data as any).items)) return (data as any).items as Task[];
  return [];
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const TasksPage: React.FC = () => {
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/tasks");
        if (!resp.ok) {
          throw new Error("Failed to load tasks: " + resp.status);
        }
        const json: TasksResponse = await resp.json();
        const list = extractTasks(json);

        list.sort((a, b) => {
          const da = a.deadline || "";
          const db = b.deadline || "";
          if (da && db && da !== db) {
            return da < db ? -1 : 1;
          }
          const sa = (a.status || "").toLowerCase();
          const sb = (b.status || "").toLowerCase();
          if (sa < sb) return -1;
          if (sa > sb) return 1;
          return 0;
        });

        if (isMounted) {
          setTasks(list);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTasks();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter) {
        if ((t.status || "").toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      if (clientFilter) {
        const code = (t.client_code || t.client_id || "").toString();
        if (!code.toLowerCase().includes(clientFilter.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, statusFilter, clientFilter]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.status) set.add(t.status);
    });
    return Array.from(set).sort();
  }, [tasks]);

  const handleOpenTask = (task: Task) => {
    if (!task.id) return;
    const params = new URLSearchParams();
    params.set("task_id", String(task.id));
    if (task.event_id) {
      params.set("event_id", String(task.event_id));
    }
    if (task.client_code || task.client_id) {
      params.set("client_code", String(task.client_code || task.client_id));
    }
    navigate(`/task-detail?${params.toString()}`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-600">
            All tasks from /api/tasks with simple filters by status and client code.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600">
              Status filter
            </label>
            <select
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600">
              Client code
            </label>
            <input
              className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder="Filter by client code..."
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Failed to load tasks: {error}
        </div>
      )}

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading tasks...
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Tasks list
          </h2>
          <span className="text-xs text-slate-500">
            {filteredTasks.length} / {tasks.length}
          </span>
        </div>
        {filteredTasks.length === 0 && !loading && (
          <div className="text-xs text-slate-500">
            No tasks for selected filters.
          </div>
        )}
        {filteredTasks.length > 0 && (
          <div className="max-h-[480px] space-y-1 overflow-auto text-xs">
            <div className="grid grid-cols-6 gap-2 border-b border-slate-100 pb-1 font-medium text-slate-600">
              <div>Task</div>
              <div>Client</div>
              <div>Status</div>
              <div>Priority</div>
              <div className="text-right">Deadline</div>
              <div className="text-right">Actions</div>
            </div>
            {filteredTasks.map((t) => {
              const title = t.title || t.id || "-";
              const clientCode = t.client_code || t.client_id || "";
              const clientLabel = t.client_label || clientCode;
              const status = t.status || "-";
              const priority = t.priority || "";
              const deadline = formatDate(t.deadline);
              return (
                <div
                  key={t.id || `${title}-${deadline}-${Math.random()}`}
                  className="grid grid-cols-6 gap-2 border-b border-slate-100 py-1 last:border-b-0"
                >
                  <div className="truncate" title={title.toString()}>
                    {title}
                  </div>
                  <div className="truncate" title={clientLabel.toString()}>
                    {clientLabel}
                  </div>
                  <div>{status}</div>
                  <div>{priority || "-"}</div>
                  <div className="text-right text-slate-700">
                    {deadline}
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => handleOpenTask(t)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksPage;
