import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type ClientProfile = {
  client_code?: string;
  code?: string;
  label?: string;
  name?: string;
  [key: string]: any;
};

type ProcessInstance = {
  instance_key?: string;
  client_code?: string;
  client_label?: string;
  year?: number;
  month?: number;
  period?: string;
  status?: string;
  steps_count?: number;
  [key: string]: any;
};

type ControlEvent = {
  id?: string;
  code?: string;
  type?: string;
  label?: string;
  category?: string;
  status?: string;
  planned_date?: string;
  due_date?: string;
  client_code?: string;
  period?: string;
  [key: string]: any;
};

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

type ProcessInstancesResponse =
  | ProcessInstance[]
  | { items?: ProcessInstance[]; instances?: ProcessInstance[]; [key: string]: any }
  | null
  | undefined;

type EventsResponse =
  | ControlEvent[]
  | { items?: ControlEvent[]; events?: ControlEvent[]; [key: string]: any }
  | null
  | undefined;

type TasksResponse =
  | Task[]
  | { tasks?: Task[]; items?: Task[]; [key: string]: any }
  | null
  | undefined;

type StatusVariant = "neutral" | "success" | "warning" | "danger" | "info";

type TimelineItem = {
  id: string;
  date: string;
  label: string;
  kind: "event" | "task";
  status?: string;
  secondary?: string;
};

function extractProcessInstances(data: ProcessInstancesResponse): ProcessInstance[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as ProcessInstance[];
  if (Array.isArray((data as any).instances)) return (data as any).instances as ProcessInstance[];
  return [];
}

function extractEvents(data: EventsResponse): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as ControlEvent[];
  if (Array.isArray((data as any).events)) return (data as any).events as ControlEvent[];
  return [];
}

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

function getClientCode(profile: ClientProfile): string {
  return (
    profile.client_code ||
    profile.code ||
    (profile as any).id ||
    ""
  );
}

function getClientLabel(profile: ClientProfile): string {
  return profile.label || profile.name || getClientCode(profile) || "Unknown client";
}

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

const buildPeriodKey = (year: number, month: number): string => {
  const m = String(month).padStart(2, "0");
  return `${year}-${m}`;
};

function getStatusVariant(status?: string, context?: "process" | "event" | "task"): StatusVariant {
  const s = (status || "").toLowerCase().trim();
  if (!s) return "neutral";

  if (context === "process") {
    if (s === "completed" || s === "done") return "success";
    if (s === "error" || s === "failed") return "danger";
    if (s === "running" || s === "in_progress") return "info";
    return "neutral";
  }

  if (context === "event") {
    if (s === "done" || s === "completed") return "success";
    if (s === "overdue" || s === "late") return "danger";
    if (s === "planned" || s === "generated" || s === "pending") return "warning";
    return "neutral";
  }

  if (context === "task") {
    if (s === "completed" || s === "done") return "success";
    if (s === "blocked") return "danger";
    if (s === "in_progress" || s === "active") return "info";
    if (s === "planned" || s === "new") return "warning";
    return "neutral";
  }

  if (s === "completed" || s === "done") return "success";
  if (s === "error" || s === "failed" || s === "overdue" || s === "late") return "danger";
  return "neutral";
}

function getStatusClasses(variant: StatusVariant): string {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (variant === "success") return base + " bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (variant === "warning") return base + " bg-amber-50 text-amber-800 border border-amber-200";
  if (variant === "danger") return base + " bg-red-50 text-red-700 border border-red-200";
  if (variant === "info") return base + " bg-sky-50 text-sky-700 border border-sky-200";
  return base + " bg-slate-50 text-slate-700 border border-slate-200";
}

const StatusBadge: React.FC<{ status?: string; context?: "process" | "event" | "task" }> = ({
  status,
  context
}) => {
  const variant = getStatusVariant(status, context);
  return <span className={getStatusClasses(variant)}>{status || "unknown"}</span>;
};

function getEventCategory(e: ControlEvent): string {
  if (e.category) return e.category;
  const code = (e.code || e.type || "").toLowerCase();
  if (!code) return "other";
  if (code.includes("salary") || code.includes("zp")) return "salary";
  if (code.includes("ndfl") || code.includes("tax")) return "tax";
  if (code.includes("tourist")) return "tourist_tax";
  if (code.includes("bank")) return "bank_statement";
  if (code.includes("doc") || code.includes("document")) return "documents";
  return "other";
}

const ReglementOverviewPage: React.FC = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);

  const [selectedClientCode, setSelectedClientCode] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [reloadTick, setReloadTick] = useState(0);

  const [devRunLoading, setDevRunLoading] = useState(false);
  const [devRunMessage, setDevRunMessage] = useState<string | null>(null);
  const [devRunError, setDevRunError] = useState<string | null>(null);

  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [eventUpdateError, setEventUpdateError] = useState<string | null>(null);

  // Load client profiles
  useEffect(() => {
    let isMounted = true;
    const loadClients = async () => {
      setClientsLoading(true);
      setClientsError(null);
      try {
        const resp = await fetch("/api/internal/client-profiles");
        if (!resp.ok) {
          throw new Error("Failed to load client profiles: " + resp.status);
        }
        const json = await resp.json();
        const list: ClientProfile[] = Array.isArray(json)
          ? json
          : Array.isArray((json as any).items)
          ? ((json as any).items as ClientProfile[])
          : Array.isArray((json as any).profiles)
          ? ((json as any).profiles as ClientProfile[])
          : [];
        list.sort((a, b) => {
          const la = getClientLabel(a).toLowerCase();
          const lb = getClientLabel(b).toLowerCase();
          if (la < lb) return -1;
          if (la > lb) return 1;
          return 0;
        });
        if (isMounted) {
          setClients(list);
          if (!selectedClientCode && list.length > 0) {
            setSelectedClientCode(getClientCode(list[0]));
          }
        }
      } catch (e: any) {
        if (isMounted) {
          setClientsError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setClientsLoading(false);
        }
      }
    };
    loadClients();
    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tasks once (global)
  useEffect(() => {
    let isMounted = true;
    const loadTasks = async () => {
      setTasksError(null);
      setTasksLoaded(false);
      try {
        const resp = await fetch("/api/tasks");
        if (!resp.ok) {
          throw new Error("Failed to load tasks: " + resp.status);
        }
        const json: TasksResponse = await resp.json();
        const list = extractTasks(json);
        if (isMounted) {
          setTasks(list);
          setTasksLoaded(true);
        }
      } catch (e: any) {
        if (isMounted) {
          setTasksError(e?.message || "Unknown error");
          setTasksLoaded(true);
        }
      }
    };
    loadTasks();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load processes and events for selected client/period (with reloadTick)
  useEffect(() => {
    if (!selectedClientCode) return;
    let isMounted = true;
    const loadData = async () => {
      setLoadingData(true);
      setDataError(null);
      setProcesses([]);
      setEvents([]);
      try {
        const monthStr = String(selectedMonth).padStart(2, "0");
        const qs = `year=${selectedYear}&month=${monthStr}`;

        const processesPromise = fetch(
          `/api/internal/process-instances-v2?client_code=${encodeURIComponent(
            selectedClientCode
          )}&${qs}`
        );

        const eventsPromise = fetch(
          `/api/control-events/${encodeURIComponent(selectedClientCode)}?${qs}`
        );

        const [procResp, evResp] = await Promise.all([processesPromise, eventsPromise]);

        if (!procResp.ok) {
          throw new Error("Failed to load processes: " + procResp.status);
        }
        if (!evResp.ok) {
          throw new Error("Failed to load events: " + evResp.status);
        }

        const procJson: ProcessInstancesResponse = await procResp.json();
        const evJson: EventsResponse = await evResp.json();

        const procList = extractProcessInstances(procJson);
        const evList = extractEvents(evJson);

        procList.sort((a, b) => {
          const sa = (a.status || "").toLowerCase();
          const sb = (b.status || "").toLowerCase();
          if (sa < sb) return -1;
          if (sa > sb) return 1;
          const ka = (a.instance_key || "").toLowerCase();
          const kb = (b.instance_key || "").toLowerCase();
          if (ka < kb) return -1;
          if (ka > kb) return 1;
          return 0;
        });

        evList.sort((a, b) => {
          const da = a.due_date || a.planned_date || "";
          const db = b.due_date || b.planned_date || "";
          if (da < db) return -1;
          if (da > db) return 1;
          const ca = (a.code || a.type || "").toLowerCase();
          const cb = (b.code || b.type || "").toLowerCase();
          if (ca < cb) return -1;
          if (ca > cb) return 1;
          return 0;
        });

        if (isMounted) {
          setProcesses(procList);
          setEvents(evList);
        }
      } catch (e: any) {
        if (isMounted) {
          setDataError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoadingData(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedClientCode, selectedYear, selectedMonth, reloadTick]);

  const selectedClient = useMemo(
    () => clients.find((c) => getClientCode(c) === selectedClientCode) || null,
    [clients, selectedClientCode]
  );

  const periodKey = buildPeriodKey(selectedYear, selectedMonth);

  const filteredTasks = useMemo(() => {
    if (!selectedClientCode) return [];
    const list = tasks.filter((t) => {
      const code = (t.client_code || t.client_id || "").toString();
      if (code !== selectedClientCode) return false;
      if (!t.deadline) return true;
      const d = new Date(t.deadline as string);
      if (Number.isNaN(d.getTime())) return true;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return y === selectedYear && m === selectedMonth;
    });

    list.sort((a, b) => {
      const da = a.deadline || "";
      const db = b.deadline || "";
      if (da < db) return -1;
      if (da > db) return 1;
      const sa = (a.status || "").toLowerCase();
      const sb = (b.status || "").toLowerCase();
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      return 0;
    });

    return list;
  }, [tasks, selectedClientCode, selectedYear, selectedMonth]);

  const summary = useMemo(() => {
    const procTotal = processes.length;
    const procCompleted = processes.filter(
      (p) => (p.status || "").toLowerCase() === "completed"
    ).length;

    const evTotal = events.length;
    const evCompleted = events.filter(
      (e) => (e.status || "").toLowerCase() === "done" || (e.status || "").toLowerCase() === "completed"
    ).length;
    const evOverdue = events.filter(
      (e) => {
        const s = (e.status || "").toLowerCase();
        return s === "overdue" || s === "late";
      }
    ).length;

    const taskTotal = filteredTasks.length;
    const taskCompleted = filteredTasks.filter(
      (t) => (t.status || "").toLowerCase() === "completed"
    ).length;
    const taskActive = filteredTasks.filter(
      (t) => {
        const s = (t.status || "").toLowerCase();
        return s === "in_progress" || s === "active";
      }
    ).length;

    return {
      procTotal,
      procCompleted,
      evTotal,
      evCompleted,
      evOverdue,
      taskTotal,
      taskCompleted,
      taskActive
    };
  }, [processes, events, filteredTasks]);

  const years = useMemo(() => {
    const base = currentYear;
    const list: number[] = [];
    for (let y = base - 1; y <= base + 1; y += 1) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    for (const e of events) {
      const rawDate = e.due_date || e.planned_date || "";
      const date = rawDate || "";
      const code = e.code || e.type || e.id || "";
      const label = e.label || e.category || code || "Event";
      const id = `event-${e.id || code}-${date || "none"}`;
      items.push({
        id,
        date,
        label,
        kind: "event",
        status: e.status,
        secondary: getEventCategory(e)
      });
    }

    for (const t of filteredTasks) {
      const rawDate = t.deadline || "";
      const date = rawDate || "";
      const label = t.title || "Task";
      const id = `task-${t.id || label}-${date || "none"}`;
      items.push({
        id,
        date,
        label,
        kind: "task",
        status: t.status,
        secondary: t.priority
      });
    }

    items.sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      if (da && db && da !== db) {
        return da < db ? -1 : 1;
      }
      if (!da && db) return 1;
      if (da && !db) return -1;
      if (a.kind !== b.kind) {
        return a.kind === "event" ? -1 : 1;
      }
      return a.label.toLowerCase() < b.label.toLowerCase() ? -1 : 1;
    });

    return items;
  }, [events, filteredTasks]);

  const handleOpenProcess = (p: ProcessInstance) => {
    const clientCode = p.client_code || selectedClientCode;
    if (!clientCode) return;
    const year = p.year || selectedYear;
    const month = p.month || selectedMonth;
    const params = new URLSearchParams();
    params.set("client_code", String(clientCode));
    params.set("year", String(year));
    params.set("month", String(month));
    if (p.instance_key) {
      params.set("instance_key", String(p.instance_key));
    }
    navigate(`/client-process-overview?${params.toString()}`);
  };

  const handleOpenEvent = (e: ControlEvent) => {
    if (!e.id) return;
    const params = new URLSearchParams();
    params.set("event_id", String(e.id));
    if (e.client_code || selectedClientCode) {
      params.set("client_code", String(e.client_code || selectedClientCode));
    }
    if (e.period || periodKey) {
      params.set("period", String(e.period || periodKey));
    }
    navigate(`/client-control-event?${params.toString()}`);
  };

  const handleOpenTask = (t: Task) => {
    if (!t.id) return;
    const params = new URLSearchParams();
    params.set("task_id", String(t.id));
    navigate(`/task-detail?${params.toString()}`);
  };

  const handleRunDevChain = async () => {
    if (!selectedClientCode) return;
    setDevRunLoading(true);
    setDevRunError(null);
    setDevRunMessage(null);
    try {
      const monthStr = String(selectedMonth).padStart(2, "0");
      const url = `/api/internal/process-chains/dev/run-for-client/${encodeURIComponent(
        selectedClientCode
      )}?year=${selectedYear}&month=${monthStr}`;
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        throw new Error("Failed to run dev chain: " + resp.status);
      }
      // Try to parse but do not fail overview if body is empty
      try {
        await resp.json();
      } catch {
        // ignore
      }
      setDevRunMessage("Dev chain executed for this client and period.");
      setReloadTick((x) => x + 1);
    } catch (e: any) {
      setDevRunError(e?.message || "Unknown error");
    } finally {
      setDevRunLoading(false);
    }
  };

  const handleRefresh = () => {
    setReloadTick((x) => x + 1);
  };

  const handleMarkEventDone = async (e: ControlEvent) => {
    if (!e.id) return;
    const currentStatus = (e.status || "").toLowerCase();
    if (currentStatus === "done" || currentStatus === "completed") {
      return;
    }
    const eventId = String(e.id);
    setUpdatingEventId(eventId);
    setEventUpdateError(null);
    try {
      const url = `/api/internal/control-events/${encodeURIComponent(eventId)}/status`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "done" })
      });
      if (!resp.ok) {
        throw new Error("Failed to update event status: " + resp.status);
      }
      // ignore body
      setReloadTick((x) => x + 1);
    } catch (err: any) {
      setEventUpdateError(err?.message || "Unknown error");
    } finally {
      setUpdatingEventId(null);
    }
  };

  const isBusy = loadingData || clientsLoading || !tasksLoaded || devRunLoading;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reglement overview</h1>
          <p className="text-sm text-slate-600">
            Single screen that shows processes, control events and tasks for a selected client and period.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600">Client</label>
              <select
                className="mt-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={selectedClientCode}
                onChange={(e) => setSelectedClientCode(e.target.value)}
                disabled={clientsLoading || !!clientsError}
              >
                {clients.length === 0 && <option value="">No clients</option>}
                {clients.map((c) => {
                  const code = getClientCode(c);
                  return (
                    <option key={code} value={code}>
                      {getClientLabel(c)} ({code})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600">Year</label>
              <select
                className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value) || currentYear)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600">Month</label>
              <select
                className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value) || currentMonth)}
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isBusy}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleRunDevChain}
              disabled={!selectedClientCode || devRunLoading}
              className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {devRunLoading ? "Running dev..." : "Run dev for this client"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Selected context
            </div>
            <div className="text-sm text-slate-800">
              {selectedClient ? getClientLabel(selectedClient) : "No client"} • {periodKey}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
              <span>
                Processes: {summary.procCompleted}/{summary.procTotal}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                Events done: {summary.evCompleted}/{summary.evTotal}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              <span>Events overdue: {summary.evOverdue}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
              <span>
                Tasks active: {summary.taskActive}/{summary.taskTotal}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
              <span>Tasks done: {summary.taskCompleted}</span>
            </div>
          </div>
        </div>
      </div>

      {clientsError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Failed to load client profiles: {clientsError}
        </div>
      )}

      {dataError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Failed to load processes or events: {dataError}
        </div>
      )}

      {tasksError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Tasks could not be loaded. Overview will show only processes and events.
        </div>
      )}

      {devRunError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          Dev chain error: {devRunError}
        </div>
      )}

      {devRunMessage && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {devRunMessage}
        </div>
      )}

      {eventUpdateError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Event status update error: {eventUpdateError}
        </div>
      )}

      {(loadingData || clientsLoading || !tasksLoaded) && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading reglement overview...
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Processes */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Processes</h2>
            <span className="text-xs text-slate-500">{processes.length}</span>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Instances from /api/internal/process-instances-v2 for selected client and period.
          </p>
          {processes.length === 0 && !loadingData && (
            <div className="text-xs text-slate-500">No processes for this period.</div>
          )}
          {processes.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-auto text-xs">
              <div className="grid grid-cols-4 gap-2 border-b border-slate-100 pb-1 font-medium text-slate-600">
                <div>Instance</div>
                <div>Status</div>
                <div className="text-right">Steps</div>
                <div className="text-right">Actions</div>
              </div>
              {processes.map((p) => (
                <div
                  key={p.instance_key || `${p.client_code || ""}-${p.period || ""}-${p.status || ""}-${Math.random()}`}
                  className="grid grid-cols-4 gap-2 border-b border-slate-100 py-1 last:border-b-0"
                >
                  <div className="truncate" title={p.instance_key || ""}>
                    {p.instance_key || "-"}
                  </div>
                  <div className="flex items-center">
                    <StatusBadge status={p.status} context="process" />
                  </div>
                  <div className="text-right text-slate-700">
                    {typeof p.steps_count === "number" ? p.steps_count : "-"}
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => handleOpenProcess(p)}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Control events</h2>
            <span className="text-xs text-slate-500">{events.length}</span>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            {"Control events from /api/control-events/{client_code}?year&month."}
          </p>
          {events.length === 0 && !loadingData && (
            <div className="text-xs text-slate-500">No events for this period.</div>
          )}
          {events.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-auto text-xs">
              <div className="grid grid-cols-5 gap-2 border-b border-slate-100 pb-1 font-medium text-slate-600">
                <div>Event</div>
                <div>Status</div>
                <div className="text-right">Due</div>
                <div className="text-right">Actions</div>
                <div className="text-right">Mark</div>
              </div>
              {events.map((e) => {
                const code = e.code || e.type || e.id || "-";
                const label = e.label || e.category || code;
                const status = e.status || "-";
                const date = formatDate(e.due_date || e.planned_date);
                const category = getEventCategory(e);
                const eventId = e.id ? String(e.id) : "";
                const isDone =
                  (e.status || "").toLowerCase() === "done" ||
                  (e.status || "").toLowerCase() === "completed";
                const isUpdating = updatingEventId === eventId;
                return (
                  <div
                    key={e.id || `${code}-${e.period || periodKey}-${Math.random()}`}
                    className="grid grid-cols-5 gap-2 border-b border-slate-100 py-1 last:border-b-0"
                  >
                    <div className="truncate" title={label}>
                      <span className="font-medium text-slate-800">{code}</span>{" "}
                      <span className="text-slate-600">{label}</span>
                      <span className="ml-1 rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 border border-slate-200">
                        {category}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <StatusBadge status={status} context="event" />
                    </div>
                    <div className="text-right text-slate-700">{date}</div>
                    <div className="text-right">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => handleOpenEvent(e)}
                      >
                        Open
                      </button>
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        disabled={!eventId || isDone || isUpdating}
                        className="inline-flex items-center rounded-md border border-emerald-500 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleMarkEventDone(e)}
                      >
                        {isDone ? "Done" : isUpdating ? "Saving..." : "Mark done"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Tasks</h2>
            <span className="text-xs text-slate-500">{filteredTasks.length}</span>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Tasks from /api/tasks filtered by client code and deadline month.
          </p>
          {filteredTasks.length === 0 && !loadingData && (
            <div className="text-xs text-slate-500">
              No tasks for this client and period.
            </div>
          )}
          {filteredTasks.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-auto text-xs">
              <div className="grid grid-cols-4 gap-2 border-b border-slate-100 pb-1 font-medium text-slate-600">
                <div>Task</div>
                <div>Status</div>
                <div className="text-right">Deadline</div>
                <div className="text-right">Actions</div>
              </div>
              {filteredTasks.map((t) => {
                const title = t.title || "-";
                const status = t.status || "-";
                const date = formatDate(t.deadline as string);
                const priority = t.priority || "";
                return (
                  <div
                    key={t.id || `${title}-${t.deadline || ""}-${Math.random()}`}
                    className="grid grid-cols-4 gap-2 border-b border-slate-100 py-1 last:border-b-0"
                  >
                    <div className="truncate" title={title}>
                      {title}
                      {priority && (
                        <span className="ml-1 rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 border border-slate-200">
                          {priority}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center">
                      <StatusBadge status={status} context="task" />
                    </div>
                    <div className="text-right text-slate-700">{date}</div>
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

      {/* Unified timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Timeline for period</h2>
          <span className="text-xs text-slate-500">
            {timelineItems.length} items
          </span>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Combined view of control events and tasks sorted by date for the selected client and period.
        </p>
        {timelineItems.length === 0 && (
          <div className="text-xs text-slate-500">
            No dated events or tasks for this period.
          </div>
        )}
        {timelineItems.length > 0 && (
          <div className="max-h-72 space-y-1 overflow-auto text-xs">
            {timelineItems.map((item) => {
              const dateLabel = item.date ? formatDate(item.date) : "-";
              const kindLabel = item.kind === "event" ? "Event" : "Task";
              const kindClasses =
                item.kind === "event"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-sky-50 text-sky-700 border-sky-200";
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 border-b border-slate-100 py-1 last:border-b-0"
                >
                  <div className="w-20 text-xs font-medium text-slate-700">
                    {dateLabel}
                  </div>
                  <div
                    className={
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                      kindClasses
                    }
                  >
                    {kindLabel}
                  </div>
                  <div className="flex-1 truncate text-slate-800" title={item.label}>
                    {item.label}
                    {item.secondary && (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-slate-500">
                        {item.secondary}
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge
                      status={item.status}
                      context={item.kind === "event" ? "event" : "task"}
                    />
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

export default ReglementOverviewPage;
