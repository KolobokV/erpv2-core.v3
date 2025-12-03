import React, { useEffect, useState } from "react";

type Task = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  description?: string;
  due_date?: string;
  deadline?: string;
  assigned_to?: string;
  assignee?: string;
};

const TasksBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setErr(null);

      // use stable backend endpoint that we know exists
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const json = await res.json();

      const items: Task[] = Array.isArray(json)
        ? json
        : json.items ?? [];

      setTasks(items);
    } catch (e: any) {
      setErr(e.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const getTitle = (t: Task) => t.title || t.name || "(no title)";
  const getStatus = (t: Task) =>
    (t.status || "unknown").toString();
  const getDeadline = (t: Task) =>
    t.due_date || t.deadline || "";

  const getAssignee = (t: Task) =>
    t.assigned_to || t.assignee || "";

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Tasks board
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All tasks from backend. Filtering and “today” logic can be
            added later, but for now board stays error-free.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadTasks}
            disabled={loading}
            className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </div>

      {err && (
        <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">
          {err}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {tasks.length === 0 && !loading ? (
          <div className="px-4 py-6 text-xs text-slate-500">
            No tasks found. Create tasks from internal processes or other
            modules.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-[11px] text-slate-500">
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Deadline</th>
                <th className="px-3 py-2 text-left">Assignee</th>
                <th className="px-3 py-2 text-left">Id</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const title = getTitle(t);
                const status = getStatus(t);
                const deadline = getDeadline(t);
                const assignee = getAssignee(t);
                const isDone =
                  status.toLowerCase() === "done" ||
                  status.toLowerCase() === "completed";

                return (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs font-semibold text-slate-900">
                        {title}
                      </div>
                      {t.description && (
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] " +
                          (isDone
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-slate-50 border-slate-200 text-slate-700")
                        }
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {deadline && (
                        <span className="font-mono text-[11px] text-slate-800">
                          {deadline}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {assignee && (
                        <span className="text-[11px] text-slate-800">
                          {assignee}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-[10px] text-slate-400">
                        {t.id}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TasksBoard;
