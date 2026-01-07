import React, { useEffect, useMemo, useState } from "react";

const TASKS_FOCUS_KEY = "erpv2_tasks_focus";

type Task = {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  assignee?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  due_date?: string | null;
  deadline?: string | null;

  client_id?: string | null;
  process_id?: string | null;
  instance_id?: string | null;

  tags?: string[];
  [key: string]: any;
};

type TasksResponse = Task[] | { items?: Task[] };

type FocusPayload = {
  clientId?: string;
  processId?: string;
  instanceId?: string;
};

const statusOptions = ["all", "planned", "overdue", "completed", "in_progress", "done"];

const statusLabel: Record<string, string> = {
  all: "\u0412\u0441\u0435",
  planned: "\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e",
  overdue: "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e",
  completed: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e",
  in_progress: "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435",
  done: "\u0413\u043e\u0442\u043e\u0432\u043e",
};

function trTitle(raw: any): string {
  const title = (raw ?? "").toString();
  const m = title.match(/^Task for\s+(.+?)\s*(\(\d{4}-\d{2}\))?\s*$/i);
  if (!m) return title;

  const core = (m[1] ?? "").trim();
  const suffix = (m[2] ?? "").trim();

  const map: Record<string, string> = {
    "Bank statement request": "\u0417\u0430\u043f\u0440\u043e\u0441 \u0431\u0430\u043d\u043a\u043e\u0432\u0441\u043a\u0438\u0445 \u0432\u044b\u043f\u0438\u0441\u043e\u043a",
    "Document request": "\u0417\u0430\u043f\u0440\u043e\u0441 \u043f\u0435\u0440\u0432\u0438\u0447\u043d\u044b\u0445 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432",
    "USN advance": "\u0410\u0432\u0430\u043d\u0441 \u043f\u043e \u0423\u0421\u041d",
    "Tourist tax": "\u0422\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0441\u0431\u043e\u0440",
  };

  const translated = map[core] ?? core;
  return `${translated}${suffix ? " " + suffix : ""}`;
}

const TasksBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [processFilter, setProcessFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const [focus, setFocus] = useState<FocusPayload | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error(`Failed to load tasks (status ${res.status})`);
      }
      const json: TasksResponse = await res.json();
      const items = Array.isArray(json) ? json : json.items ?? [];
      setTasks(items);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TASKS_FOCUS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FocusPayload;
        setFocus(parsed);

        if (parsed.clientId) setClientFilter(parsed.clientId);
        if (parsed.processId) setProcessFilter(parsed.processId);
      }
    } catch {
      // ignore storage errors
    }

    loadTasks().catch(() => {
      // handled in state
    });
  }, []);

  const derived = useMemo(() => {
    const clientIds = new Set<string>();
    const processIds = new Set<string>();

    let total = tasks.length;
    let overdue = 0;
    let planned = 0;
    let completed = 0;

    for (const t of tasks) {
      const status = (t.status ?? "").toString().toLowerCase();
      if (status === "overdue") overdue += 1;
      else if (status === "completed" || status === "done") completed += 1;
      else if (status === "planned" || status === "new") planned += 1;

      if (t.client_id) clientIds.add(String(t.client_id));
      if (t.process_id) processIds.add(String(t.process_id));
    }

    let filtered = [...tasks];

    if (statusFilter !== "all") {
      const wanted = statusFilter.toLowerCase();
      filtered = filtered.filter((t) =>
        (t.status ?? "").toString().toLowerCase() === wanted
      );
    }

    if (clientFilter !== "all") {
      filtered = filtered.filter(
        (t) => (t.client_id ?? "") === clientFilter
      );
    }

    if (processFilter !== "all") {
      filtered = filtered.filter(
        (t) => (t.process_id ?? "") === processFilter
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((t) => {
        const title = (t.title ?? "").toString().toLowerCase();
        const desc = (t.description ?? "").toString().toLowerCase();
        const id = (t.id ?? "").toString().toLowerCase();
        return (
          title.includes(q) ||
          desc.includes(q) ||
          id.includes(q)
        );
      });
    }

    const clientList = Array.from(clientIds).sort();
    const processList = Array.from(processIds).sort();

    return {
      total,
      overdue,
      planned,
      completed,
      clientList,
      processList,
      filteredTasks: filtered,
    };
  }, [tasks, statusFilter, clientFilter, processFilter, search]);

  const clearFocus = () => {
    try {
      window.localStorage.removeItem(TASKS_FOCUS_KEY);
    } catch {
      // ignore
    }
    setFocus(null);
  };

  return (
    <div className="space-y-3">
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {"\u0417\u0430\u0434\u0430\u0447\u0438"}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {"\u0421\u043f\u0438\u0441\u043e\u043a \u0437\u0430\u0434\u0430\u0447 \u0438\u0437 backend \u0441 \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c\u0438 \u043f\u043e \u0441\u0442\u0430\u0442\u0443\u0441\u0443, \u043a\u043b\u0438\u0435\u043d\u0442\u0443, \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u0443 \u0438 \u043f\u043e\u0438\u0441\u043a\u043e\u043c \u043f\u043e \u0442\u0435\u043a\u0441\u0442\u0443."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={loadTasks}
              className="px-2 py-1 rounded-md border border-gray-300 bg-white text-xs hover:bg-gray-50"
              disabled={loading}
            >
              {loading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
            </button>
          </div>
        </div>

        {err && (
          <div className="border border-red-300 bg-red-50 text-red-800 text-xs px-3 py-2 rounded-md">
            {err}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-600">{"\u0421\u0442\u0430\u0442\u0443\u0441:"}</span>
            <select
              className="border rounded px-2 py-0.5 text-xs bg-slate-900 text-slate-100"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s] ?? s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-600">{"\u041a\u043b\u0438\u0435\u043d\u0442:"}</span>
            <select
              className="border rounded px-2 py-0.5 text-xs bg-slate-900 text-slate-100"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">{"\u0412\u0441\u0435"}</option>
              {derived.clientList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-600">{"\u041f\u0440\u043e\u0446\u0435\u0441\u0441:"}</span>
            <select
              className="border rounded px-2 py-0.5 text-xs bg-slate-900 text-slate-100"
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
            >
              <option value="all">{"\u0412\u0441\u0435"}</option>
              {derived.processList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 flex-1 min-w-[160px]">
            <span className="text-slate-600">{"\u041f\u043e\u0438\u0441\u043a:"}</span>
            <input
              className="border rounded px-2 py-0.5 text-xs bg-slate-900 text-slate-100 flex-1"
              placeholder="\u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a / id / \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="text-xs text-slate-600 ml-auto">
            {"\u0412\u0441\u0435\u0433\u043e:"} {derived.total} · {"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e:"} {derived.overdue} · {"\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043e:"}{" "}
            {derived.planned} · {"\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e:"} {derived.completed}
          </div>
        </div>

        {focus && (
          <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-3 items-center">
            <span className="font-semibold text-slate-700">
              {"\u0424\u043e\u043a\u0443\u0441 \u0438\u0437 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0445 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432:"}
            </span>
            {focus.clientId && (
              <span>
                {"\u043a\u043b\u0438\u0435\u043d\u0442:"}{" "}
                <span className="font-mono text-slate-900">{focus.clientId}</span>
              </span>
            )}
            {focus.processId && (
              <span>
                {"\u043f\u0440\u043e\u0446\u0435\u0441\u0441:"}{" "}
                <span className="font-mono text-slate-900">{focus.processId}</span>
              </span>
            )}
            {focus.instanceId && (
              <span>
                {"\u0438\u043d\u0441\u0442\u0430\u043d\u0441:"}{" "}
                <span className="font-mono text-slate-900">{focus.instanceId}</span>
              </span>
            )}
            <button
              type="button"
              onClick={clearFocus}
              className="ml-auto px-2 py-0.5 rounded border border-gray-300 bg-white text-[11px] hover:bg-gray-50"
            >
              {"\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u043e\u043a\u0443\u0441"}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm max-h-[540px] overflow-auto">
        {derived.filteredTasks.length === 0 && !loading ? (
          <div className="px-4 py-6 text-xs text-slate-500">
            {"\u041d\u0435\u0442 \u0437\u0430\u0434\u0430\u0447 \u0434\u043b\u044f \u0442\u0435\u043a\u0443\u0449\u0438\u0445 \u0444\u0438\u043b\u044c\u0442\u0440\u043e\u0432."}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900 text-[11px] text-slate-100">
                <th className="px-3 py-2 text-left">{"\u0417\u0430\u0434\u0430\u0447\u0430"}</th>
                <th className="px-3 py-2 text-left">{"\u0421\u0442\u0430\u0442\u0443\u0441"}</th>
                <th className="px-3 py-2 text-left">{"\u041a\u043b\u0438\u0435\u043d\u0442"}</th>
                <th className="px-3 py-2 text-left">{"\u041f\u0440\u043e\u0446\u0435\u0441\u0441"}</th>
                <th className="px-3 py-2 text-left">{"\u0418\u043d\u0441\u0442\u0430\u043d\u0441"}</th>
                <th className="px-3 py-2 text-left">{"\u0421\u0440\u043e\u043a"}</th>
                <th className="px-3 py-2 text-left">{"\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c"}</th>
                <th className="px-3 py-2 text-left">Id</th>
              </tr>
            </thead>
            <tbody>
              {derived.filteredTasks.map((t, index) => {
                const statusRaw = (t.status ?? "planned").toString();
                const status = statusRaw.toLowerCase();
                const due =
                  t.due_date ?? t.deadline ?? t.target_date ?? null;

                const baseKey =
                  t.id ??
                  `${t.client_id ?? "c"}-${t.process_id ?? "p"}-${t.instance_id ?? "i"}`;
                const key = `${baseKey}-${index}`;

                const title = trTitle(t.title);

                return (
                  <tr
                    key={key}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="text-xs font-semibold text-slate-900">
                        {title || "(no title)"}
                      </div>
                      {t.description && (
                        <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] " +
                          (status === "overdue"
                            ? "bg-red-50 border-red-200 text-red-700"
                            : status === "completed" || status === "done"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-slate-50 border-slate-200 text-slate-700")
                        }
                      >
                        {statusLabel[statusRaw.toLowerCase()] ?? statusRaw}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-[11px] text-slate-800">
                        {t.client_id ?? ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-[11px] text-slate-800">
                        {t.process_id ?? ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="font-mono text-[11px] text-slate-800">
                        {t.instance_id ?? ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      {due && (
                        <span className="font-mono text-[11px] text-slate-800">
                          {due}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {t.assignee && (
                        <span className="text-[11px] text-slate-800">
                          {t.assignee}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {t.id && (
                        <span className="font-mono text-[11px] text-slate-500">
                          {t.id}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default TasksBoard;
