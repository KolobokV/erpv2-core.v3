import React, { useEffect, useState } from "react";

type ClientProfile = {
  id?: string;
  code?: string;
  label?: string;
  short_label?: string;
  profile_type?: string;
  [key: string]: any;
};

type ProcessInstance = {
  id?: string;
  client_id?: string;
  client_code?: string;
  period?: string;
  status?: string;
  computed_status?: string;
  [key: string]: any;
};

type ControlEvent = {
  id?: string;
  client_id?: string;
  client_code?: string;
  period?: string;
  status?: string;
  [key: string]: any;
};

type Task = {
  id?: string;
  client_id?: string;
  client_code?: string;
  status?: string;
  deadline?: string;
  [key: string]: any;
};

type OverviewRow = {
  clientCode: string;
  label: string;
  profileType?: string;
  period: string;
  processTotal: number;
  processClosed: number;
  processOpen: number;
  processStuck: number;
  eventsTotal: number;
  eventsNew: number;
  eventsDone: number;
  eventsError: number;
  tasksTotal: number;
  tasksNew: number;
  tasksInProgress: number;
  tasksDone: number;
};

type HealthLevel = "ok" | "attention" | "error";

function normalizeStatus(raw?: string | null): string {
  const s = (raw || "").toLowerCase();
  if (s === "completed" || s === "closed" || s === "done") return "closed";
  if (s === "waiting" || s === "open" || s === "in_progress") return "open";
  if (s === "error" || s === "stuck" || s === "failed") return "stuck";
  if (!s) return "unknown";
  return s;
}

function extractProfiles(data: any): ClientProfile[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).profiles)) return (data as any).profiles as ClientProfile[];
  if (Array.isArray((data as any).clients)) return (data as any).clients as ClientProfile[];
  return [];
}

function extractInstances(data: any): ProcessInstance[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ProcessInstance[];
  if (Array.isArray((data as any).instances)) return (data as any).instances as ProcessInstance[];
  if (Array.isArray((data as any).items)) return (data as any).items as ProcessInstance[];
  return [];
}

function extractEvents(data: any): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ControlEvent[];
  if (Array.isArray((data as any).events)) return (data as any).events as ControlEvent[];
  if (Array.isArray((data as any).items)) return (data as any).items as ControlEvent[];
  return [];
}

function extractTasks(data: any): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Task[];
  if (Array.isArray((data as any).tasks)) return (data as any).tasks as Task[];
  if (Array.isArray((data as any).items)) return (data as any).items as Task[];
  return [];
}

function getClientKey(obj: any): string {
  return String(
    (obj && (obj.code || obj.client_code || obj.client_id || obj.id)) || ""
  );
}

function getClientLabel(profile: ClientProfile): string {
  return (
    profile.short_label ||
    profile.label ||
    profile.code ||
    profile.id ||
    ""
  ).toString();
}

function parseDeadlineMonth(deadline?: string): { year: number; month: number } | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function computeHealth(row: OverviewRow): HealthLevel {
  if (row.processStuck > 0 || row.eventsError > 0) {
    return "error";
  }
  if (
    row.processOpen > 0 ||
    row.eventsNew > 0 ||
    row.tasksNew > 0 ||
    row.tasksInProgress > 0
  ) {
    return "attention";
  }
  return "ok";
}

function getHealthLabel(level: HealthLevel): string {
  if (level === "ok") return "OK";
  if (level === "attention") return "Attention";
  return "Issues";
}

function getHealthClasses(level: HealthLevel): string {
  if (level === "ok") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (level === "attention") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

function formatProfileType(value?: string): string {
  if (!value) return "-";
  return value;
}

const ReglementOverviewPage: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [profiles, setProfiles] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [runningReglement, setRunningReglement] = useState(false);
  const [reglementMessage, setReglementMessage] = useState<string | null>(null);
  const [reglementError, setReglementError] = useState<string | null>(null);

  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      setReglementMessage(null);
      setReglementError(null);

      const [profilesResp, instancesResp, eventsResp, tasksResp] = await Promise.all([
        fetch("/api/internal/client-profiles"),
        fetch("/api/internal/process-instances-v2/"),
        fetch("/api/internal/control-events/"),
        fetch("/api/tasks"),
      ]);

      if (!profilesResp.ok) {
        throw new Error("Failed to load client profiles: " + profilesResp.status);
      }
      if (!instancesResp.ok) {
        throw new Error("Failed to load process instances: " + instancesResp.status);
      }
      if (!eventsResp.ok) {
        throw new Error("Failed to load control events: " + eventsResp.status);
      }
      if (!tasksResp.ok) {
        throw new Error("Failed to load tasks: " + tasksResp.status);
      }

      const profilesJson = await profilesResp.json();
      const instancesJson = await instancesResp.json();
      const eventsJson = await eventsResp.json();
      const tasksJson = await tasksResp.json();

      setProfiles(extractProfiles(profilesJson));
      setInstances(extractInstances(instancesJson));
      setEvents(extractEvents(eventsJson));
      setTasks(extractTasks(tasksJson));
    } catch (e: any) {
      setError(e?.message || "Failed to load overview data");
      setProfiles([]);
      setInstances([]);
      setEvents([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunReglement = async () => {
    try {
      setRunningReglement(true);
      setReglementError(null);
      setReglementMessage(null);

      const url = `/api/internal/process-chains/reglement/run?year=${year}&month=${month}`;
      const resp = await fetch(url, { method: "POST" });

      if (!resp.ok) {
        throw new Error("Reglement run failed: " + resp.status);
      }

      let message = "Reglement run completed";
      try {
        const json = await resp.json();
        const maybe =
          (json as any).status ||
          (json as any).result ||
          (json as any).message ||
          null;
        if (maybe && typeof maybe === "string") {
          message = maybe;
        }
      } catch {
        // ignore json parse errors
      }

      setReglementMessage(`${message} for period ${periodLabel}`);
      await reload();
    } catch (e: any) {
      setReglementError(e?.message || "Reglement run failed");
    } finally {
      setRunningReglement(false);
    }
  };

  const handleYearChange = (e: any) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) {
      setYear(v);
    }
  };

  const handleMonthChange = (e: any) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v >= 1 && v <= 12) {
      setMonth(v);
    }
  };

  const rows: OverviewRow[] = (() => {
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return [];
    }

    const resultMap = new Map<string, OverviewRow>();

    const ensureRow = (clientCode: string, label: string, profileType?: string): OverviewRow => {
      let row = resultMap.get(clientCode);
      if (!row) {
        row = {
          clientCode,
          label,
          profileType,
          period: periodLabel,
          processTotal: 0,
          processClosed: 0,
          processOpen: 0,
          processStuck: 0,
          eventsTotal: 0,
          eventsNew: 0,
          eventsDone: 0,
          eventsError: 0,
          tasksTotal: 0,
          tasksNew: 0,
          tasksInProgress: 0,
          tasksDone: 0,
        };
        resultMap.set(clientCode, row);
      } else if (!row.profileType && profileType) {
        row.profileType = profileType;
      }
      return row;
    };

    for (const p of profiles as ClientProfile[]) {
      const clientCode = getClientKey(p);
      if (!clientCode) {
        continue;
      }
      const label = getClientLabel(p);
      const profileType =
        (p as any).profile_type ||
        (p as any).tax_system ||
        (p as any).regime ||
        undefined;
      ensureRow(clientCode, label, profileType);
    }

    const period = periodLabel;

    if (Array.isArray(instances)) {
      for (const inst of instances as ProcessInstance[]) {
        const clientCode = inst.client_code || inst.client_id || "";
        if (!clientCode) continue;

        const instancePeriod = String(inst.period || "");
        if (instancePeriod && instancePeriod !== period) {
          continue;
        }

        const codeStr = String(clientCode);
        const existing = resultMap.get(codeStr);
        const label = existing ? existing.label : codeStr;
        const row = ensureRow(codeStr, label, existing?.profileType);

        row.processTotal += 1;
        const s = normalizeStatus(inst.computed_status || inst.status);
        if (s === "closed") {
          row.processClosed += 1;
        } else if (s === "stuck") {
          row.processStuck += 1;
        } else {
          row.processOpen += 1;
        }
      }
    }

    if (Array.isArray(events)) {
      for (const ev of events as ControlEvent[]) {
        const clientCode = ev.client_code || ev.client_id || "";
        if (!clientCode) continue;

        const eventPeriod = String(ev.period || "");
        if (eventPeriod && eventPeriod !== period) {
          continue;
        }

        const codeStr = String(clientCode);
        const existing = resultMap.get(codeStr);
        const label = existing ? existing.label : codeStr;
        const row = ensureRow(codeStr, label, existing?.profileType);

        row.eventsTotal += 1;
        const s = (ev.status || "").toLowerCase();
        if (s === "new") {
          row.eventsNew += 1;
        } else if (s === "done" || s === "completed" || s === "closed") {
          row.eventsDone += 1;
        } else if (s === "error" || s === "failed") {
          row.eventsError += 1;
        }
      }
    }

    if (Array.isArray(tasks)) {
      for (const t of tasks as Task[]) {
        const clientCode = (t as any).client_code || (t as any).client_id || "";
        if (!clientCode) continue;

        const deadlineInfo = parseDeadlineMonth(t.deadline);
        if (deadlineInfo) {
          if (deadlineInfo.year !== year || deadlineInfo.month !== month) {
            continue;
          }
        } else {
          continue;
        }

        const codeStr = String(clientCode);
        const existing = resultMap.get(codeStr);
        const label = existing ? existing.label : codeStr;
        const row = ensureRow(codeStr, label, existing?.profileType);

        row.tasksTotal += 1;
        const s = (t.status || "").toLowerCase();
        if (s === "new") {
          row.tasksNew += 1;
        } else if (s === "in_progress" || s === "in-progress" || s === "open") {
          row.tasksInProgress += 1;
        } else if (s === "done" || s === "completed" || s === "closed") {
          row.tasksDone += 1;
        }
      }
    }

    const rowsArray = Array.from(resultMap.values());
    rowsArray.sort((a, b) => a.label.localeCompare(b.label));
    return rowsArray;
  })();

  let clientsOk = 0;
  let clientsWithIssues = 0;
  let totalTasksForPeriod = 0;

  for (const row of rows) {
    const health = computeHealth(row);
    if (health === "ok") {
      clientsOk += 1;
    } else {
      clientsWithIssues += 1;
    }
    totalTasksForPeriod += row.tasksTotal;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reglement overview</h1>
          <p className="text-sm text-slate-600">
            Period view: processes, control events and tasks per client for selected year and month.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600">Year</label>
            <input
              type="number"
              value={year}
              onChange={handleYearChange}
              className="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600">Month</label>
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={handleMonthChange}
              className="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={reload}
              className="mt-4 inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "Reloading..." : "Reload data"}
            </button>
            <button
              type="button"
              disabled={runningReglement}
              onClick={handleRunReglement}
              className="mt-4 inline-flex items-center rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {runningReglement ? "Running reglement..." : "Run reglement for period"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        <div>
          <span className="font-semibold">Current period:</span> {periodLabel}
        </div>
        <div className="flex flex-wrap gap-3">
          <span>
            Clients: <span className="font-semibold">{rows.length}</span>
          </span>
          <span className="text-emerald-700">
            OK: <span className="font-semibold">{clientsOk}</span>
          </span>
          <span className="text-amber-700">
            With issues: <span className="font-semibold">{clientsWithIssues}</span>
          </span>
          <span>
            Tasks for period: <span className="font-semibold">{totalTasksForPeriod}</span>
          </span>
        </div>
      </div>

      {reglementError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Reglement error: {reglementError}
        </div>
      )}

      {reglementMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {reglementMessage}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No clients found in /api/internal/client-profiles.
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Clients for period {periodLabel}
            </h2>
            <span className="text-xs text-slate-500">
              Processes, control events and tasks aggregated per client.
            </span>
          </div>

          <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-100 px-3 py-2 text-left font-medium">
                    Client
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2 text-left font-medium">
                    Profile
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2 text-left font-medium">
                    Processes
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2 text-left font-medium">
                    Control events
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2 text-left font-medium">
                    Tasks (period)
                  </th>
                  <th className="border-b border-slate-100 px-3 py-2 text-left font-medium">
                    Health
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const health = computeHealth(row);
                  const healthLabel = getHealthLabel(health);
                  const healthClasses = getHealthClasses(health);

                  return (
                    <tr key={row.clientCode} className="odd:bg-white even:bg-slate-50/40">
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        <div className="font-medium text-slate-900">{row.label}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.clientCode} · {row.period}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {formatProfileType(row.profileType)}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">Total</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {row.processTotal}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700">Closed</span>
                            <span className="font-semibold text-emerald-700">
                              {row.processClosed}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-700">Open</span>
                            <span className="font-semibold text-amber-700">
                              {row.processOpen}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-red-700">Stuck</span>
                            <span className="font-semibold text-red-700">
                              {row.processStuck}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">Total</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {row.eventsTotal}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-700">New</span>
                            <span className="font-semibold text-amber-700">
                              {row.eventsNew}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700">Done</span>
                            <span className="font-semibold text-emerald-700">
                              {row.eventsDone}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-red-700">Error</span>
                            <span className="font-semibold text-red-700">
                              {row.eventsError}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">Total</span>
                            <span className="text-xs font-semibold text-slate-800">
                              {row.tasksTotal}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-700">New</span>
                            <span className="font-semibold text-amber-700">
                              {row.tasksNew}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-sky-700">In progress</span>
                            <span className="font-semibold text-sky-700">
                              {row.tasksInProgress}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700">Done</span>
                            <span className="font-semibold text-emerald-700">
                              {row.tasksDone}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 align-top">
                        <span
                          className={
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            getHealthClasses(health)
                          }
                        >
                          {getHealthLabel(health)}
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
    </div>
  );
};

export default ReglementOverviewPage;
