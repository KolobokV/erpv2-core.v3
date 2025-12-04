import React, { useEffect, useMemo, useState } from "react";

type ControlEvent = {
  id: string;
  client_id: string;
  date: string;
  title: string;
  category: string;
  status: string;
  depends_on?: string[];
  description?: string;
  tags?: string[];
  source?: string;
};

type GenerateTasksResponse = {
  client_id: string;
  tasks_suggested: number;
  tasks: TaskPayload[];
};

type TaskPayload = {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  assignee?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  due_date?: string | null;
};

const DEMO_CLIENTS = [
  { id: "ip_usn_dr", label: "IP USN DR" },
  { id: "ooo_osno_3_zp1025", label: "OOO OSNO + VAT (3 emp, 10/25)" },
  {
    id: "ooo_usn_dr_tour_zp520",
    label: "OOO USN DR + tourist fee (2 emp, 5/20)"
  }
];

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" }
];

const now = new Date();

const ControlEventsPage: React.FC = () => {
  const [clientId, setClientId] = useState<string>("ip_usn_dr");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isGeneratingTasks, setIsGeneratingTasks] = useState<boolean>(false);
  const [generateResult, setGenerateResult] = useState<GenerateTasksResponse | null>(
    null
  );
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [processFilter, setProcessFilter] = useState<string>("all");

  const loadEvents = async () => {
    setIsLoading(true);
    setError(null);
    setEvents([]);
    try {
      const params = new URLSearchParams();
      if (year) params.append("year", String(year));
      if (month) params.append("month", String(month));

      const url = `/api/control-events/${encodeURIComponent(
        clientId
      )}?${params.toString()}`;

      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Request failed with status ${resp.status}`);
      }
      const data = await resp.json();
      const eventsData = (data?.events ?? []) as ControlEvent[];
      setEvents(eventsData);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load control events.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTasks = async () => {
    setIsGeneratingTasks(true);
    setGenerateError(null);
    setGenerateResult(null);
    try {
      const params = new URLSearchParams();
      if (year) params.append("year", String(year));
      if (month) params.append("month", String(month));

      const url = `/api/control-events/${encodeURIComponent(
        clientId
      )}/generate-tasks?${params.toString()}`;

      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        throw new Error(`Generate-tasks failed with status ${resp.status}`);
      }

      const data = (await resp.json()) as GenerateTasksResponse;
      setGenerateResult(data);

      const tasks = data.tasks ?? [];
      for (const t of tasks) {
        const payload: TaskPayload = { ...t };
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
    } catch (err: any) {
      setGenerateError(err?.message ?? "Failed to generate tasks.");
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  useEffect(() => {
    loadEvents().catch(() => {
      // error is handled in state
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year, month]);

  const currentMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? String(month);

  const derived = useMemo(() => {
    const uniqueCategories = new Set<string>();
    const processTagSet = new Set<string>();
    const todayIso = new Date().toISOString().slice(0, 10);

    let total = 0;
    let overdue = 0;
    let planned = 0;
    let completed = 0;

    const perProcess: Record<
      string,
      { total: number; overdue: number; planned: number; completed: number }
    > = {};

    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
    let nextDeadline: string | null = null;

    for (const e of sorted) {
      total += 1;
      if (e.status === "overdue") overdue += 1;
      else if (e.status === "completed") completed += 1;
      else if (e.status === "planned") planned += 1;

      if (!nextDeadline && e.date >= todayIso) {
        nextDeadline = `${e.date} — ${e.title}`;
      }

      if (e.category) {
        uniqueCategories.add(e.category);
      }

      const tags = e.tags ?? [];
      const processTags = tags.filter((t) => t.startsWith("process:"));
      for (const pt of processTags) {
        processTagSet.add(pt);
        if (!perProcess[pt]) {
          perProcess[pt] = { total: 0, overdue: 0, planned: 0, completed: 0 };
        }
        perProcess[pt].total += 1;
        if (e.status === "overdue") perProcess[pt].overdue += 1;
        else if (e.status === "completed") perProcess[pt].completed += 1;
        else if (e.status === "planned") perProcess[pt].planned += 1;
      }
    }

    const categories = Array.from(uniqueCategories).sort();
    const processTags = Array.from(processTagSet).sort();

    let filtered = [...sorted];
    if (statusFilter !== "all") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((e) => e.category === categoryFilter);
    }
    if (processFilter !== "all") {
      filtered = filtered.filter((e) =>
        (e.tags ?? []).includes(processFilter)
      );
    }

    return {
      total,
      overdue,
      planned,
      completed,
      nextDeadline,
      categories,
      processTags,
      perProcess,
      filteredEvents: filtered
    };
  }, [events, statusFilter, categoryFilter, processFilter]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">Control Events</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <div className="border rounded-lg p-3 md:p-4 bg-white/5">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-xs font-medium opacity-70 mb-1">
                  Client
                </label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-slate-900"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  {DEMO_CLIENTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium opacity-70 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1 text-sm w-24 bg-slate-900"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value) || year)}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-medium opacity-70 mb-1">
                  Month
                </label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-slate-900"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {monthOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 ml-auto flex-wrap">
                <button
                  className="px-3 py-1 rounded text-sm border border-sky-500 hover:bg-sky-500/10"
                  onClick={loadEvents}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Reload events"}
                </button>
                <button
                  className="px-3 py-1 rounded text-sm border border-emerald-500 hover:bg-emerald-500/10"
                  onClick={handleGenerateTasks}
                  disabled={isGeneratingTasks}
                >
                  {isGeneratingTasks ? "Generating tasks..." : "Generate tasks"}
                </button>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-3 md:p-4 bg-white/5">
            <div className="flex flex-wrap gap-3 items-center justify-between mb-2">
              <div className="font-semibold text-sm">
                Filters for control events
              </div>
              <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                <div className="flex items-center gap-1">
                  <span className="opacity-70 text-xs">Status:</span>
                  <select
                    className="border rounded px-2 py-0.5 text-xs bg-slate-900"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="planned">Planned</option>
                    <option value="overdue">Overdue</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="opacity-70 text-xs">Category:</span>
                  <select
                    className="border rounded px-2 py-0.5 text-xs bg-slate-900"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {derived.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="opacity-70 text-xs">Process:</span>
                  <select
                    className="border rounded px-2 py-0.5 text-xs bg-slate-900"
                    value={processFilter}
                    onChange={(e) => setProcessFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {derived.processTags.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 mb-2">{error}</div>
            )}

            {derived.nextDeadline && (
              <div className="text-xs mb-2">
                <span className="font-medium">Next deadline: </span>
                {derived.nextDeadline}
              </div>
            )}

            <div className="overflow-auto max-h-80 border rounded">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">Title</th>
                    <th className="px-2 py-1 text-left">Category</th>
                    <th className="px-2 py-1 text-left">Status</th>
                    <th className="px-2 py-1 text-left">Processes</th>
                    <th className="px-2 py-1 text-left">Depends on</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.filteredEvents.map((e) => {
                    const processTags = (e.tags ?? []).filter((t) =>
                      t.startsWith("process:")
                    );
                    return (
                      <tr key={e.id} className="border-t border-slate-800">
                        <td className="px-2 py-1 whitespace-nowrap font-mono text-[11px] md:text-xs">
                          {e.date}
                        </td>
                        <td className="px-2 py-1">{e.title}</td>
                        <td className="px-2 py-1">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-800 text-[10px] md:text-xs">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] md:text-xs ${
                              e.status === "overdue"
                                ? "bg-red-900/60"
                                : e.status === "completed"
                                ? "bg-emerald-900/60"
                                : "bg-sky-900/60"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-[10px] md:text-xs">
                          {processTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {processTags.map((t) => (
                                <span
                                  key={t}
                                  className="inline-flex px-2 py-0.5 rounded-full border border-slate-700"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-2 py-1 text-[10px] md:text-xs">
                          {e.depends_on && e.depends_on.length > 0
                            ? e.depends_on.join(", ")
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                  {derived.filteredEvents.length === 0 &&
                    !isLoading &&
                    !error && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-2 py-3 text-center text-xs opacity-70"
                        >
                          No events for selected period and filters.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border rounded-lg p-3 md:p-4 bg-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-sm">
                Generated tasks from control events
              </div>
              {generateResult && (
                <div className="text-xs md:text-sm opacity-80">
                  Suggested: {generateResult.tasks_suggested} · Pushed to /api/tasks
                </div>
              )}
            </div>
            {generateError && (
              <div className="text-xs text-red-400 mb-2">{generateError}</div>
            )}
            {!generateResult && !generateError && (
              <div className="text-xs opacity-70">
                Use "Generate tasks" button above to create tasks based on current
                period control events. Tasks will be available in Tasks dashboard.
              </div>
            )}
            {generateResult && (
              <div className="text-xs md:text-sm space-y-1">
                {generateResult.tasks.map((t, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-800 rounded px-2 py-1"
                  >
                    <div className="font-medium">{t.title}</div>
                    {t.due_date && (
                      <div className="font-mono text-[11px]">
                        Due: {t.due_date}
                      </div>
                    )}
                    {t.description && (
                      <div className="opacity-80 text-[11px] mt-1">
                        {t.description}
                      </div>
                    )}
                  </div>
                ))}
                {generateResult.tasks.length === 0 && (
                  <div className="opacity-70">
                    No tasks in response. Check backend logic for task generation.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="border rounded-lg p-3 md:p-4 bg-white/5 text-xs md:text-sm">
            <div className="font-semibold text-sm mb-1">
              Summary for current period
            </div>
            <div className="space-y-1">
              <div>
                <span className="font-medium">Client:</span> {clientId}
              </div>
              <div>
                <span className="font-medium">Period:</span> {year} -{" "}
                {currentMonthLabel}
              </div>
              <div>
                <span className="font-medium">Total events:</span> {derived.total}
              </div>
              <div>
                <span className="font-medium">Overdue:</span> {derived.overdue}
              </div>
              <div>
                <span className="font-medium">Planned:</span> {derived.planned}
              </div>
              <div>
                <span className="font-medium">Completed:</span> {derived.completed}
              </div>
              {derived.nextDeadline && (
                <div className="mt-1">
                  <span className="font-medium">Next deadline:</span>{" "}
                  {derived.nextDeadline}
                </div>
              )}
            </div>
          </div>

          <div className="border rounded-lg p-3 md:p-4 bg-white/5 text-xs md:text-sm">
            <div className="font-semibold text-sm mb-1">
              Process coverage (process:* tags)
            </div>
            {derived.processTags.length === 0 && (
              <div className="opacity-70">
                No process tags on events for selected period.
              </div>
            )}
            {derived.processTags.length > 0 && (
              <div className="space-y-1">
                {derived.processTags.map((p) => {
                  const stats = derived.perProcess[p];
                  return (
                    <div
                      key={p}
                      className="border border-slate-800 rounded px-2 py-1"
                    >
                      <div className="font-mono text-[11px] mb-1">{p}</div>
                      <div className="text-[11px] space-x-2">
                        <span>Total: {stats.total}</span>
                        <span>Overdue: {stats.overdue}</span>
                        <span>Planned: {stats.planned}</span>
                        <span>Completed: {stats.completed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-3 md:p-4 bg-white/5 text-xs md:text-sm">
            <div className="font-semibold text-sm mb-1">
              Link to internal processes
            </div>
            <ul className="list-disc ml-4 space-y-1">
              <li>
                process:* tags on events correspond to internal process codes in
                definitions.
              </li>
              <li>
                Process coverage above shows which processes are active and how many
                events are overdue or planned.
              </li>
              <li>
                Tasks generated here are consumed by Internal Processes and Tasks
                dashboard as operational workload.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlEventsPage;
