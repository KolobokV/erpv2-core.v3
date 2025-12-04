import React, { useEffect, useMemo, useState } from "react";

type ClientProfileConfig = {
  id: string;
  label: string;
  description: string;
  taxSystem: string;
  vat: string;
  payroll: string;
  employees: number;
  touristFee: string;
  coreProcesses: string[];
  controlEventCategories: string[];
};

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

const CLIENT_PROFILES: ClientProfileConfig[] = [
  {
    id: "ip_usn_dr",
    label: "IP USN DR",
    description:
      "Individual entrepreneur on simplified tax system (income minus expenses). Fixed contributions, USN advances, annual declaration, 1 percent control.",
    taxSystem: "USN income minus expenses",
    vat: "No VAT, standard USN regime.",
    payroll: "No regular payroll in base scenario (can be extended later).",
    employees: 0,
    touristFee: "No tourist fee.",
    coreProcesses: [
      "process:bank_flow",
      "process:docs_collect",
      "process:usn_month_close",
      "process:usn_quarter_close",
      "process:usn_year_close"
    ],
    controlEventCategories: [
      "bank",
      "docs",
      "tax_usn_book",
      "tax_usn",
      "tax_usn_decl"
    ]
  },
  {
    id: "ooo_osno_3_zp1025",
    label: "OOO OSNO + VAT (3 employees, salary 10/25)",
    description:
      "Limited liability company on general tax system with VAT, three employees, payroll on 10 and 25 of each month.",
    taxSystem: "OSNO with VAT",
    vat: "Quarterly VAT declaration and payment.",
    payroll: "Payroll twice a month (10 and 25), NDFL next day after each salary.",
    employees: 3,
    touristFee: "No tourist fee.",
    coreProcesses: [
      "process:bank_flow",
      "process:docs_collect",
      "process:payroll_cycle",
      "process:payroll_close",
      "process:payroll_reports",
      "process:vat_quarter_close",
      "process:year_close"
    ],
    controlEventCategories: [
      "salary",
      "tax_ndfl",
      "insurance",
      "bank",
      "docs",
      "tax_vat",
      "tax_6ndfl",
      "tax_rsv",
      "annual_report",
      "pension_report"
    ]
  },
  {
    id: "ooo_usn_dr_tour_zp520",
    label: "OOO USN DR + tourist fee (2 employees, salary 5/20)",
    description:
      "Limited liability company on simplified tax system (income minus expenses) with tourist fee, two employees, payroll on 5 and 20.",
    taxSystem: "USN income minus expenses + tourist fee",
    vat: "No VAT, focus on USN and tourist fee.",
    payroll: "Payroll twice a month (5 and 20), NDFL next day after each salary.",
    employees: 2,
    touristFee: "Monthly tourist fee based on guests statistics.",
    coreProcesses: [
      "process:bank_flow",
      "process:docs_collect",
      "process:payroll_cycle",
      "process:payroll_close",
      "process:tourist_fee_month",
      "process:usn_quarter_close",
      "process:usn_year_close",
      "process:year_close"
    ],
    controlEventCategories: [
      "salary",
      "tax_ndfl",
      "insurance",
      "tax_tourist",
      "bank",
      "docs",
      "tax_usn",
      "tax_usn_decl",
      "pension_report"
    ]
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

const ClientProfilePage: React.FC = () => {
  const [clientId, setClientId] = useState<string>("ip_usn_dr");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [isGeneratingTasks, setIsGeneratingTasks] = useState<boolean>(false);
  const [generateResult, setGenerateResult] = useState<GenerateTasksResponse | null>(
    null
  );
  const [generateError, setGenerateError] = useState<string | null>(null);

  const profile = useMemo<ClientProfileConfig | undefined>(
    () => CLIENT_PROFILES.find((p) => p.id === clientId),
    [clientId]
  );

  const stats = useMemo(() => {
    const total = events.length;
    const overdue = events.filter((e) => e.status === "overdue").length;
    const planned = events.filter((e) => e.status === "planned").length;
    const completed = events.filter((e) => e.status === "completed").length;

    let nextDeadline: string | null = null;
    if (events.length > 0) {
      const sorted = [...events].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const todayIso = new Date().toISOString().slice(0, 10);
      const future = sorted.find((e) => e.date >= todayIso);
      nextDeadline = future ? `${future.date} — ${future.title}` : null;
    }

    return { total, overdue, planned, completed, nextDeadline };
  }, [events]);

  const loadEvents = async () => {
    setIsLoadingEvents(true);
    setEventsError(null);
    setEvents([]);
    try {
      const params = new URLSearchParams();
      if (year) {
        params.append("year", String(year));
      }
      if (month) {
        params.append("month", String(month));
      }
      const url = `/api/control-events/${encodeURIComponent(
        clientId
      )}?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Control events request failed with status ${resp.status}`);
      }
      const data = await resp.json();
      const eventsData = (data?.events ?? []) as ControlEvent[];
      setEvents(eventsData);
    } catch (err: any) {
      setEventsError(err?.message ?? "Failed to load control events.");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleGenerateTasks = async () => {
    setIsGeneratingTasks(true);
    setGenerateError(null);
    setGenerateResult(null);
    try {
      const params = new URLSearchParams();
      if (year) {
        params.append("year", String(year));
      }
      if (month) {
        params.append("month", String(month));
      }
      const url = `/api/control-events/${encodeURIComponent(
        clientId
      )}/generate-tasks?${params.toString()}`;

      const resp = await fetch(url, {
        method: "POST"
      });
      if (!resp.ok) {
        throw new Error(
          `Generate tasks request failed with status ${resp.status}`
        );
      }

      const data = (await resp.json()) as GenerateTasksResponse;
      setGenerateResult(data);

      const tasks = data.tasks ?? [];
      for (const t of tasks) {
        const payload: TaskPayload = {
          ...t
        };
        await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
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
      // error is already handled
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year, month]);

  const currentMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? String(month);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">Client Profile 2.0</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <div className="border rounded-lg p-3 md:p-4 bg-white/5">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col">
                <label className="text-xs font-medium opacity-70 mb-1">
                  Client ID
                </label>
                <select
                  className="border rounded px-2 py-1 text-sm bg-slate-900"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  {CLIENT_PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id}
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
                  disabled={isLoadingEvents}
                >
                  {isLoadingEvents ? "Loading..." : "Reload events"}
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

          {profile && (
            <div className="border rounded-lg p-3 md:p-4 bg-white/5 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    {profile.label}
                  </h2>
                  <p className="text-xs md:text-sm opacity-80">
                    {profile.description}
                  </p>
                </div>
                <div className="text-right text-xs md:text-sm">
                  <div className="font-mono">
                    {clientId} · {year}-{currentMonthLabel}
                  </div>
                  <div className="opacity-70">Control map snapshot</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-xs md:text-sm">
                <div className="space-y-1">
                  <div className="font-semibold text-sm">Tax and VAT</div>
                  <div>
                    <span className="font-medium">Tax system: </span>
                    {profile.taxSystem}
                  </div>
                  <div>
                    <span className="font-medium">VAT: </span>
                    {profile.vat}
                  </div>
                  <div>
                    <span className="font-medium">Tourist fee: </span>
                    {profile.touristFee}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-sm">Payroll and staff</div>
                  <div>
                    <span className="font-medium">Employees: </span>
                    {profile.employees}
                  </div>
                  <div>
                    <span className="font-medium">Payroll schedule: </span>
                    {profile.payroll}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-sm">Processes and events</div>
                  <div>
                    <span className="font-medium">Core processes:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.coreProcesses.map((p) => (
                      <span
                        key={p}
                        className="inline-flex px-2 py-0.5 rounded-full border text-[10px] md:text-xs"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2">
                    <span className="font-medium">Control event categories:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.controlEventCategories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex px-2 py-0.5 rounded-full bg-slate-800 text-[10px] md:text-xs"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-3 md:p-4 bg-white/5">
            <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-sm">Control events</div>
              <div className="text-xs md:text-sm opacity-80">
                Total: {stats.total} · Overdue: {stats.overdue} · Planned:{" "}
                {stats.planned} · Completed: {stats.completed}
              </div>
            </div>

            {eventsError && (
              <div className="text-xs text-red-400 mb-2">
                {eventsError}
              </div>
            )}

            {stats.nextDeadline && (
              <div className="text-xs mb-2">
                <span className="font-medium">Next deadline: </span>
                {stats.nextDeadline}
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
                    <th className="px-2 py-1 text-left">Depends on</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
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
                        {e.depends_on && e.depends_on.length > 0
                          ? e.depends_on.join(", ")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && !isLoadingEvents && !eventsError && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-3 text-center text-xs opacity-70"
                      >
                        No events for selected period.
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
                Use "Generate tasks" above to create tasks based on current period
                control events. They will be available in Tasks dashboard.
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
              How this page connects things
            </div>
            <ul className="list-disc ml-4 space-y-1">
              <li>Client ID is shared with control events generator.</li>
              <li>
                Control events are loaded directly from
                {" /api/control-events/{client_id}"} for selected period.
              </li>
              <li>
                Tasks are generated via
                {" /api/control-events/{client_id}/generate-tasks"}
                and pushed to /api/tasks.
              </li>
              <li>
                Core process tags (process:*) are aligned with internal processes
                definitions.
              </li>
            </ul>
          </div>

          <div className="border rounded-lg p-3 md:p-4 bg-white/5 text-xs md:text-sm">
            <div className="font-semibold text-sm mb-1">Quick notes</div>
            <ul className="list-disc ml-4 space-y-1">
              <li>
                Use this page as entry point to see tax regime, payroll, tourist fee
                and control map for a client.
              </li>
              <li>
                Control events table gives exact operational calendar for the
                period.
              </li>
              <li>
                Tasks dashboard consumes tasks created here and on Control Events
                page.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProfilePage;
