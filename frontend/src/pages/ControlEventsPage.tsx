import React, { useEffect, useMemo, useState } from "react";

const CLIENT_PROFILE_FOCUS_KEY = "erpv2_client_profile_focus";

type ControlEvent = {
  id?: string;
  client_id?: string;
  date?: string;
  title?: string;
  description?: string;
  status?: string;
  tags?: string[];
  process_id?: string;
};

type ControlEventsResponse = {
  client_id: string;
  year: number;
  month: number;
  events: ControlEvent[];
};

type SuggestedTask = {
  title?: string;
  description?: string;
  status?: string;
  due_date?: string | null;
  client_id?: string | null;
  process_id?: string | null;
  tags?: string[];
};

type TasksSuggestionResponse = {
  client_id: string;
  tasks_suggested: number;
  tasks: SuggestedTask[];
  error?: string | null;
};

type EventsSummary = {
  total: number;
  planned: number;
  overdue: number;
  other: number;
};

const parsePeriod = (
  period: string
): { year?: number; month?: number } => {
  const trimmed = period.trim();
  if (!trimmed) {
    return {};
  }

  // expect "YYYY-MM"
  const yStr = trimmed.slice(0, 4);
  const mStr = trimmed.slice(5, 7);

  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10);

  if (Number.isNaN(y) || Number.isNaN(m)) {
    return {};
  }

  return { year: y, month: m };
};

const ControlEventsPage: React.FC = () => {
  const [clientId, setClientId] = useState("");
  const [period, setPeriod] = useState("");
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [eventsMeta, setEventsMeta] = useState<{
    client_id?: string;
    year?: number;
    month?: number;
  }>({});
  const [tasksResult, setTasksResult] =
    useState<TasksSuggestionResponse | null>(null);

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLIENT_PROFILE_FOCUS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.clientId === "string" && parsed.clientId) {
        setClientId(parsed.clientId);
      }
    } catch {
      // ignore
    }
  }, []);

  const summary: EventsSummary = useMemo(() => {
    const total = events.length;
    let planned = 0;
    let overdue = 0;
    let other = 0;

    for (const ev of events) {
      const status = (ev.status || "").toLowerCase();
      if (!status || status === "planned") {
        planned += 1;
      } else if (status === "overdue" || status === "late") {
        overdue += 1;
      } else {
        other += 1;
      }
    }

    return { total, planned, overdue, other };
  }, [events]);

  const sortedEvents = useMemo(() => {
    const copy = [...events];
    copy.sort((a, b) => {
      const aKey = (a.date || "") + (a.id || "");
      const bKey = (b.date || "") + (b.id || "");
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return 0;
    });
    return copy;
  }, [events]);

  const buildQueryString = () => {
    const { year, month } = parsePeriod(period);
    const params = new URLSearchParams();
    if (year && Number.isFinite(year)) {
      params.append("year", String(year));
    }
    if (month && Number.isFinite(month)) {
      params.append("month", String(month));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  const handleLoadEvents = async () => {
    if (!clientId.trim()) {
      setError("Client id is required");
      return;
    }

    try {
      setError(null);
      setLoadingEvents(true);
      setTasksResult(null);

      const qs = buildQueryString();
      const url = `/api/control-events/${encodeURIComponent(clientId.trim())}${qs}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load control events (HTTP ${res.status})`);
      }

      const json: ControlEventsResponse | any = await res.json();
      const eventsList: ControlEvent[] = Array.isArray(json?.events)
        ? json.events
        : [];

      setEvents(eventsList);
      setEventsMeta({
        client_id: json?.client_id ?? clientId.trim(),
        year: json?.year,
        month: json?.month,
      });
    } catch (e: any) {
      setError(e?.message || "Failed to load control events");
      setEvents([]);
      setEventsMeta({});
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleGenerateTasks = async () => {
    if (!clientId.trim()) {
      setError("Client id is required");
      return;
    }

    try {
      setError(null);
      setLoadingTasks(true);

      const qs = buildQueryString();
      const url = `/api/control-events/${encodeURIComponent(
        clientId.trim()
      )}/generate-tasks${qs}`;

      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        throw new Error(`Failed to generate tasks (HTTP ${res.status})`);
      }

      const json: TasksSuggestionResponse | any = await res.json();
      const tasks: SuggestedTask[] = Array.isArray(json?.tasks)
        ? json.tasks
        : [];

      setTasksResult({
        client_id: json?.client_id ?? clientId.trim(),
        tasks_suggested:
          typeof json?.tasks_suggested === "number"
            ? json.tasks_suggested
            : tasks.length,
        tasks,
        error: typeof json?.error === "string" ? json.error : null,
      });
    } catch (e: any) {
      setError(e?.message || "Failed to generate tasks from control events");
      setTasksResult(null);
    } finally {
      setLoadingTasks(false);
    }
  };

  const hasEvents = events.length > 0;
  const hasTasksPreview = !!tasksResult && tasksResult.tasks.length > 0;

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="border-b border-gray-200 pb-2">
        <h1 className="text-base font-semibold text-gray-900">
          Control events
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Periodic control events for a single client and tasks suggested from
          them.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-700">
            Client id
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="client_id (required)"
            className="h-8 w-52 rounded border border-gray-300 px-2 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-700">
            Period (optional)
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-8 w-40 rounded border border-gray-300 px-2 text-xs"
          />
          <span className="text-[10px] text-gray-400">
            Uses backend defaults if empty.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-700">
            Actions
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLoadEvents}
              disabled={loadingEvents || loadingTasks}
              className="inline-flex h-8 items-center rounded border border-gray-300 bg-white px-3 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingEvents ? "Loading..." : "Load events"}
            </button>
            <button
              type="button"
              onClick={handleGenerateTasks}
              disabled={loadingTasks || loadingEvents}
              className="inline-flex h-8 items-center rounded border border-blue-500 bg-blue-600 px-3 text-[11px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingTasks ? "Generating..." : "Generate tasks"}
            </button>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end gap-1 text-[11px] text-gray-600">
          <div>
            Total events:{" "}
            <span className="font-mono text-gray-900">
              {summary.total}
            </span>
          </div>
          <div className="flex gap-3">
            <span>
              Planned:{" "}
              <span className="font-mono text-gray-900">
                {summary.planned}
              </span>
            </span>
            <span>
              Overdue:{" "}
              <span className="font-mono text-gray-900">
                {summary.overdue}
              </span>
            </span>
            <span>
              Other:{" "}
              <span className="font-mono text-gray-900">
                {summary.other}
              </span>
            </span>
          </div>
          {eventsMeta.client_id && (
            <div className="text-[10px] text-gray-400">
              Loaded for {eventsMeta.client_id}
              {eventsMeta.year && eventsMeta.month
                ? ` @ ${eventsMeta.year}-${String(eventsMeta.month).padStart(
                    2,
                    "0"
                  )}`
                : ""}
            </div>
          )}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(380px,1.2fr)_minmax(260px,0.9fr)] gap-3">
        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Events
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Generated control events for the selected client and period.
              </p>
            </div>
          </div>

          {!hasEvents ? (
            <div className="flex-1 px-2 py-4 text-xs text-gray-500">
              No events loaded. Use{" "}
              <span className="font-mono text-xs">Load events</span> above to
              fetch them.
            </div>
          ) : (
            <div className="mt-2 max-h-[520px] overflow-auto pr-1">
              <table className="min-w-full border-separate border-spacing-y-[4px] text-xs">
                <thead className="sticky top-0 bg-white text-[11px] text-gray-500">
                  <tr>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Date
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Title
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="w-[120px] px-2 py-1 text-left font-medium">
                      Tags
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.map((ev) => {
                    const key = ev.id || `${ev.date || ""}_${ev.title || ""}`;

                    const status = (ev.status || "").toLowerCase();
                    let statusClasses =
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] border ";
                    if (status === "overdue" || status === "late") {
                      statusClasses +=
                        "border-red-200 bg-red-50 text-red-700";
                    } else if (status === "planned" || !status) {
                      statusClasses +=
                        "border-gray-200 bg-gray-50 text-gray-700";
                    } else {
                      statusClasses +=
                        "border-blue-200 bg-blue-50 text-blue-700";
                    }

                    const tags = Array.isArray(ev.tags) ? ev.tags : [];

                    return (
                      <tr
                        key={key}
                        className="rounded-md border border-gray-100 bg-gray-50 text-[11px] text-gray-800 shadow-sm"
                      >
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[11px] text-gray-900">
                            {ev.date || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="font-medium text-gray-900">
                            {ev.title || "(no title)"}
                          </div>
                          {ev.description && (
                            <div className="mt-0.5 text-[10px] text-gray-500 line-clamp-2">
                              {ev.description}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className={statusClasses}>
                            {ev.status || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          {tags.length === 0 ? (
                            <span className="text-[10px] text-gray-400">
                              no tags
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {tags.map((t, idx) => (
                                <span
                                  key={`${t}_${idx}`}
                                  className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-700"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="border-b border-gray-100 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Suggested tasks
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Preview of tasks generated from the events for this client.
            </p>
          </div>

          {!tasksResult ? (
            <div className="flex-1 px-2 py-4 text-xs text-gray-500">
              No task suggestion yet. Use{" "}
              <span className="font-mono text-xs">Generate tasks</span> above.
            </div>
          ) : (
            <div className="mt-2 flex-1 space-y-3">
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700">
                <div>
                  Client:{" "}
                  <span className="font-mono text-gray-900">
                    {tasksResult.client_id}
                  </span>
                </div>
                <div>
                  Suggested tasks:{" "}
                  <span className="font-mono text-gray-900">
                    {tasksResult.tasks_suggested}
                  </span>
                </div>
                {tasksResult.error && (
                  <div className="mt-1 text-[11px] text-red-600">
                    Backend reported: {tasksResult.error}
                  </div>
                )}
              </div>

              {!hasTasksPreview ? (
                <div className="px-2 py-2 text-xs text-gray-500">
                  No detailed tasks payload returned.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto pr-1">
                  <table className="min-w-full border-separate border-spacing-y-[4px] text-xs">
                    <thead className="text-[11px] text-gray-500">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">
                          Title
                        </th>
                        <th className="w-[80px] px-2 py-1 text-left font-medium">
                          Status
                        </th>
                        <th className="w-[90px] px-2 py-1 text-left font-medium">
                          Due
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksResult.tasks.map((task, index) => {
                        const key = `${task.title || "task"}_${index}`;
                        return (
                          <tr
                            key={key}
                            className="rounded-md border border-gray-100 bg-white text-[11px] text-gray-800 shadow-sm"
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
                                {task.status || "planned"}
                              </span>
                            </td>
                            <td className="px-2 py-1 align-top">
                              <span className="font-mono text-[10px] text-gray-800">
                                {task.due_date || "n/a"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ControlEventsPage;
