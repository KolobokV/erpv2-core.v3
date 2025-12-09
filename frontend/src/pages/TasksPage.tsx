import React, { useEffect, useState } from "react";

type Task = {
  id?: string;
  title?: string;
  description?: string;
  client_id?: string;
  client_label?: string;
  assigned_to?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  group_key?: string;
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
  return d.toLocaleString();
}

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setTasks([]);
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
          if (da < db) return -1;
          if (da > db) return 1;
          return 0;
        });
        if (isMounted) {
          setTasks(list);
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Unknown error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Tasks</h1>
        <p className="text-sm text-slate-600">
          Read-only debug list of tasks from /api/tasks.
        </p>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          Loading tasks...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          No tasks loaded.
        </div>
      )}

      {tasks.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white text-xs">
          <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-800">
              Tasks ({tasks.length})
            </span>
          </div>
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t, idx) => {
                  const clientLabel = t.client_label || t.client_id || "-";
                  const title = t.title || "-";
                  const status = t.status || "-";
                  const priority = t.priority || "-";
                  const deadline = formatDate(t.deadline as string);

                  return (
                    <tr key={t.id || idx} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800">
                        <div className="truncate max-w-[260px]" title={title}>
                          {title}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="truncate max-w-[180px]" title={clientLabel}>
                          {clientLabel}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                            (status === "completed" || status === "done"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "in_progress"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-slate-100 text-slate-700")
                          }
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{priority}</td>
                      <td className="px-3 py-2 text-slate-700">{deadline}</td>
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
