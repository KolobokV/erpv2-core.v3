import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatusPill, { StatusPillTone } from "../components/ui/StatusPill";
import HorizonList, { HorizonItem } from "../components/ui/HorizonList";

type ClientProfile = {
  id?: string;
  client_id?: string;
  client_code?: string;
  code?: string;
  label?: string;
  name?: string;
  profile_id?: string;
  tax_system?: string;
  regime?: string;
  type?: string;
  salary_payment_days?: (number | string)[];
  payment_dates?: (number | string)[];
  is_active?: boolean;
  [key: string]: any;
};

type Task = {
  id?: string;
  task_id?: string;
  client_code?: string;
  title?: string;
  status?: string;
  due_date?: string;
  planned_date?: string;
  [key: string]: any;
};

type InstanceInfo = {
  id?: string;
  instance_id?: string;
  client_code?: string;
  client_id?: string;
  period?: string;
  status?: string;
  [key: string]: any;
};

type ControlEvent = {
  id?: string;
  event_id?: string;
  code?: string;
  client_code?: string;
  label?: string;
  title?: string;
  description?: string;
  event_type?: string;
  status?: string;
  due_date?: string;
  deadline?: string;
  date?: string;
  [key: string]: any;
};

type TasksResponse =
  | Task[]
  | { tasks?: Task[]; items?: Task[]; [key: string]: any }
  | null
  | undefined;

type InstancesResponse =
  | InstanceInfo[]
  | { instances?: InstanceInfo[]; items?: InstanceInfo[]; [key: string]: any }
  | null
  | undefined;

type ControlEventsResponse =
  | ControlEvent[]
  | { events?: ControlEvent[]; items?: ControlEvent[]; [key: string]: any }
  | null
  | undefined;

type ClientRow = {
  profile: ClientProfile;
  clientCode: string;
  clientLabel: string;
  taxSystem: string;
  salaryDays: string;
  isActive: boolean;
  tasksTotal: number;
  tasksOverdue: number;
  tasksToday: number;
  tasksNew: number;
  lastReglementPeriod: string;
  lastReglementStatus: string;
};

const CONTROL_EVENTS_HORIZON_MONTHS_FORWARD = 15;

function extractTasks(data: TasksResponse): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).tasks)) return (data as any).tasks as Task[];
  if (Array.isArray((data as any).items)) return (data as any).items as Task[];
  return [];
}

function extractInstances(data: InstancesResponse): InstanceInfo[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).instances)) {
    return (data as any).instances as InstanceInfo[];
  }
  if (Array.isArray((data as any).items)) {
    return (data as any).items as InstanceInfo[];
  }
  return [];
}

function extractControlEvents(data: ControlEventsResponse): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).events)) {
    return (data as any).events as ControlEvent[];
  }
  if (Array.isArray((data as any).items)) {
    return (data as any).items as ControlEvent[];
  }
  return [];
}

function getStatusKey(status?: string): string {
  return (status || "").toLowerCase();
}

function getStatusBadgeClasses(status?: string): string {
  const s = getStatusKey(status);
  if (s === "completed" || s === "done" || s === "ok") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (s === "error" || s === "failed") {
    return "bg-red-50 text-red-800 border-red-200";
  }
  if (s === "in_progress" || s === "in-progress" || s === "running") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (s === "new" || s === "planned" || s === "created") {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getStatusLabel(status?: string): string {
  const s = getStatusKey(status);
  if (!s) return "-";
  if (s === "completed" || s === "done" || s === "ok") return "Completed";
  if (s === "error" || s === "failed") return "Error";
  if (s === "in_progress" || s === "in-progress" || s === "running")
    return "In progress";
  if (s === "new" || s === "planned" || s === "created") return "Planned";
  return status || "-";
}

function getClientCodeFromProfile(profile: ClientProfile): string {
  const raw =
    profile.client_code ||
    profile.code ||
    profile.client_id ||
    profile.id ||
    profile.profile_id ||
    "";
  return String(raw || "").trim();
}

function normalizeSalaryDays(profile: ClientProfile): string {
  const raw =
    profile.salary_payment_days ||
    profile.payment_dates ||
    ([] as (number | string)[]);
  if (Array.isArray(raw)) {
    return raw.map(String).join(", ");
  }
  if (typeof raw === "string") return raw;
  return "";
}

function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function parseIsoDateLike(
  value: string | undefined | null
): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d;
}

function getDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDateDiffInDays(target: Date, base: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

function getControlEventDueRaw(ev: ControlEvent): string {
  return (ev && (ev.due_date || ev.deadline || ev.date)) || "";
}

const ClientProfilePage: React.FC = () => {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [controlEvents, setControlEvents] = useState<ControlEvent[]>([]);
  const [controlEventsLoading, setControlEventsLoading] = useState(false);
  const [controlEventsError, setControlEventsError] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterTaxSystem, setFilterTaxSystem] = useState("");
  const [filterHasSalary, setFilterHasSalary] = useState<"" | "yes" | "no">(
    ""
  );
  const [filterActive, setFilterActive] = useState<
    "" | "active" | "inactive"
  >("");

  const [selectedClientCode, setSelectedClientCode] = useState<string | null>(
    null
  );
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profilesResp, tasksResp, instancesResp] = await Promise.all([
          fetch("/api/internal/client-profiles/"),
          fetch("/api/tasks"),
          fetch("/api/internal/process-instances-v2/"),
        ]);

        if (!profilesResp.ok) {
          throw new Error(
            "Failed to load client profiles: " + profilesResp.status
          );
        }
        if (!tasksResp.ok) {
          throw new Error("Failed to load tasks: " + tasksResp.status);
        }
        if (!instancesResp.ok) {
          throw new Error(
            "Failed to load process instances: " + instancesResp.status
          );
        }

        const profilesJson = (await profilesResp.json()) as ClientProfile[] | {
          items?: ClientProfile[];
        } | null;

        const tasksJson: TasksResponse = await tasksResp.json();
        const instancesJson: InstancesResponse = await instancesResp.json();

        if (!mounted) return;

        let profilesList: ClientProfile[] = [];
        if (Array.isArray(profilesJson)) {
          profilesList = profilesJson;
        } else if (profilesJson && Array.isArray((profilesJson as any).items)) {
          profilesList = (profilesJson as any).items as ClientProfile[];
        }

        setProfiles(profilesList);
        setTasks(extractTasks(tasksJson));
        setInstances(extractInstances(instancesJson));
      } catch (e: any) {
        if (!mounted) return;
        setError(
          e?.message ||
            "Failed to load client profiles / tasks / instances"
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadAll();

    return () => {
      mounted = false;
    };
  }, []);

  const now = new Date();
  const todayDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const todayStr = getDateOnlyString(todayDate);

  const rows: ClientRow[] = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];

    const tasksByClient = new Map<string, Task[]>();
    for (const t of tasks || []) {
      const rawCode = t.client_code || "";
      const code = String(rawCode || "").trim();
      if (!code) continue;
      if (!tasksByClient.has(code)) tasksByClient.set(code, []);
      tasksByClient.get(code)!.push(t);
    }

    const instancesByClient = new Map<string, InstanceInfo[]>();
    for (const inst of instances || []) {
      const rawCode =
        inst.client_code && String(inst.client_code).trim().length > 0
          ? inst.client_code
          : inst.client_id && String(inst.client_id).trim().length > 0
          ? inst.client_id
          : "";
      const code = String(rawCode || "").trim();
      if (!code) continue;
      if (!instancesByClient.has(code)) instancesByClient.set(code, []);
      instancesByClient.get(code)!.push(inst);
    }

    const result: ClientRow[] = [];

    for (const profile of profiles) {
      const clientCode = getClientCodeFromProfile(profile);
      if (!clientCode) continue;

      const clientLabel =
        profile.label || profile.name || profile.code || clientCode;
      const taxSystem =
        profile.tax_system ||
        profile.regime ||
        profile.type ||
        (profile as any).tax ||
        "";

      const salaryDays = normalizeSalaryDays(profile);
      const isActive = profile.is_active !== false;

      const clientTasks = tasksByClient.get(clientCode) || [];
      const tasksTotal = clientTasks.length;
      let tasksOverdue = 0;
      let tasksToday = 0;
      let tasksNew = 0;

      for (const t of clientTasks) {
        const statusKey = getStatusKey(t.status);
        if (statusKey === "new" || statusKey === "planned" || statusKey === "") {
          tasksNew += 1;
        }
        const dueRaw = t.due_date || t.planned_date;
        const due = parseIsoDateLike(dueRaw || null);
        if (!due) continue;
        const dueStr = getDateOnlyString(due);
        if (dueStr < todayStr) {
          tasksOverdue += 1;
        } else if (dueStr === todayStr) {
          tasksToday += 1;
        }
      }

      let lastReglementPeriod = "";
      let lastReglementStatus = "";
      const clientInstances = instancesByClient.get(clientCode) || [];
      if (clientInstances.length > 0) {
        let best: InstanceInfo | null = null;
        for (const inst of clientInstances) {
          if (!inst.period) continue;
          if (!best) {
            best = inst;
          } else if (String(inst.period) > String(best.period)) {
            best = inst;
          }
        }
        if (best) {
          lastReglementPeriod = String(best.period);
          lastReglementStatus = best.status || "";
        }
      }

      result.push({
        profile,
        clientCode,
        clientLabel,
        taxSystem,
        salaryDays,
        isActive,
        tasksTotal,
        tasksOverdue,
        tasksToday,
        tasksNew,
        lastReglementPeriod,
        lastReglementStatus,
      });
    }

    result.sort((a, b) => {
      if (a.tasksOverdue !== b.tasksOverdue) {
        return b.tasksOverdue - a.tasksOverdue;
      }
      if (a.tasksToday !== b.tasksToday) {
        return b.tasksToday - a.tasksToday;
      }
      return a.clientLabel.localeCompare(b.clientLabel);
    });

    return result;
  }, [profiles, tasks, instances, todayStr]);

  const filteredRows = useMemo(() => {
    let list = rows;

    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      list = list.filter((r) => {
        return (
          r.clientCode.toLowerCase().includes(q) ||
          r.clientLabel.toLowerCase().includes(q) ||
          r.taxSystem.toLowerCase().includes(q)
        );
      });
    }

    if (filterTaxSystem.trim()) {
      const q = filterTaxSystem.trim().toLowerCase();
      list = list.filter((r) => r.taxSystem.toLowerCase().includes(q));
    }

    if (filterHasSalary === "yes") {
      list = list.filter((r) => r.salaryDays.length > 0);
    } else if (filterHasSalary === "no") {
      list = list.filter((r) => r.salaryDays.length === 0);
    }

    if (filterActive === "active") {
      list = list.filter((r) => r.isActive);
    } else if (filterActive === "inactive") {
      list = list.filter((r) => !r.isActive);
    }

    return list;
  }, [rows, filterText, filterTaxSystem, filterHasSalary, filterActive]);

  useEffect(() => {
    if (!selectedClientCode && filteredRows.length > 0) {
      setSelectedClientCode(filteredRows[0].clientCode);
    }
  }, [filteredRows, selectedClientCode]);

  useEffect(() => {
    if (!selectedClientCode) {
      setControlEvents([]);
      setControlEventsError(null);
      return;
    }

    let active = true;

    const loadControlEvents = async () => {
      setControlEventsLoading(true);
      setControlEventsError(null);

      const aggregated: ControlEvent[] = [];
      let errorMessage: string | null = null;

      try {
        const nowLocal = new Date();
        const startYear = nowLocal.getFullYear();
        const startMonth = nowLocal.getMonth() + 1;

        for (
          let offset = 0;
          offset <= CONTROL_EVENTS_HORIZON_MONTHS_FORWARD;
          offset++
        ) {
          const totalMonths = startMonth - 1 + offset;
          const year = startYear + Math.floor(totalMonths / 12);
          const month = (totalMonths % 12) + 1;
          const url =
            "/api/control-events/" +
            encodeURIComponent(selectedClientCode) +
            "?year=" +
            year +
            "&month=" +
            month;

          try {
            const resp = await fetch(url);
            if (!resp.ok) {
              if (resp.status === 404) {
                continue;
              }
              if (!errorMessage) {
                errorMessage =
                  "Failed to load control events: " +
                  resp.status +
                  " for " +
                  year +
                  "-" +
                  String(month).padStart(2, "0");
              }
              continue;
            }
            const json = (await resp.json()) as ControlEventsResponse;
            const list = extractControlEvents(json);
            if (list && list.length > 0) {
              aggregated.push(...list);
            }
          } catch {
            if (!errorMessage) {
              errorMessage = "Error while loading control events";
            }
          }
        }
      } finally {
        if (!active) return;
        setControlEvents(aggregated);
        setControlEventsLoading(false);
        if (errorMessage) {
          setControlEventsError(errorMessage);
        }
      }
    };

    loadControlEvents();

    return () => {
      active = false;
    };
  }, [selectedClientCode]);

  const selectedRow = useMemo(() => {
    if (!selectedClientCode) return null;
    return (
      rows.find((r) => r.clientCode === selectedClientCode) || null
    );
  }, [selectedClientCode, rows]);

  const controlEventsSummary = useMemo(() => {
    if (!controlEvents || controlEvents.length === 0) {
      return {
        total: 0,
        overdueCount: 0,
        todayCount: 0,
        next7Count: 0,
        futureCount: 0,
        importantEvents: [] as { ev: ControlEvent; dueDate: Date }[],
      };
    }

    const eventsWithDue: { ev: ControlEvent; dueDate: Date }[] = [];
    for (const ev of controlEvents) {
      const raw = getControlEventDueRaw(ev);
      const d = parseIsoDateLike(raw);
      if (!d) continue;
      eventsWithDue.push({ ev, dueDate: d });
    }

    if (eventsWithDue.length === 0) {
      return {
        total: 0,
        overdueCount: 0,
        todayCount: 0,
        next7Count: 0,
        futureCount: 0,
        importantEvents: [] as { ev: ControlEvent; dueDate: Date }[],
      };
    }

    eventsWithDue.sort((a, b) => {
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    let overdueCount = 0;
    let todayCount = 0;
    let next7Count = 0;
    let futureCount = 0;
    const important: { ev: ControlEvent; dueDate: Date }[] = [];

    for (const item of eventsWithDue) {
      const d = item.dueDate;
      const diffDays = getDateDiffInDays(d, todayDate);
      if (diffDays < 0) {
        overdueCount += 1;
      } else if (diffDays === 0) {
        todayCount += 1;
      } else if (diffDays > 0 && diffDays <= 7) {
        next7Count += 1;
      } else if (diffDays > 7 && diffDays <= 90) {
        futureCount += 1;
      }

      if (diffDays < 0 || diffDays <= 7) {
        important.push(item);
      }
    }

    const importantLimited = important.slice(0, 20);

    return {
      total: eventsWithDue.length,
      overdueCount,
      todayCount,
      next7Count,
      futureCount,
      importantEvents: importantLimited,
    };
  }, [controlEvents, todayDate]);

  const nearestEventsItems: HorizonItem[] = useMemo(() => {
    if (!controlEventsSummary.importantEvents.length) {
      return [];
    }

    return controlEventsSummary.importantEvents.map((item, idx) => {
      const ev = item.ev;
      const d = item.dueDate;
      const dateStr = getDateOnlyString(d);
      const diff = getDateDiffInDays(d, todayDate);

      let highlight: HorizonItem["highlight"] = "normal";
      if (diff < 0) {
        highlight = "overdue";
      } else if (diff === 0) {
        highlight = "today";
      } else if (diff > 0 && diff <= 7) {
        highlight = "soon";
      }

      const title =
        ev.label || ev.title || ev.code || ev.event_type || "Event";

      return {
        id: (ev.id || ev.event_id || ev.code || "ev") + "-" + idx,
        title,
        date: dateStr,
        category: ev.event_type || undefined,
        highlight,
      };
    });
  }, [controlEventsSummary, todayDate]);

  const stats = useMemo(() => {
    const total = rows.length;
    let ipCount = 0;
    let oooCount = 0;
    let usnCount = 0;
    let osnoCount = 0;
    let salaryCount = 0;

    for (const r of rows) {
      const codeLower = r.clientCode.toLowerCase();
      const taxLower = r.taxSystem.toLowerCase();
      if (codeLower.startsWith("ip_")) ipCount += 1;
      if (codeLower.startsWith("ooo_")) oooCount += 1;
      if (taxLower.includes("usn")) usnCount += 1;
      if (taxLower.includes("osno") || taxLower.includes("nds")) {
        osnoCount += 1;
      }
      if (r.salaryDays) salaryCount += 1;
    }

    return { total, ipCount, oooCount, usnCount, osnoCount, salaryCount };
  }, [rows]);

  const riskSummary = useMemo(() => {
    if (!selectedRow) {
      return {
        level: "none" as "none" | "low" | "medium" | "high",
        label: "No client selected",
        description: "Select a client to see risk and compliance status.",
        badgeClasses: "bg-slate-50 text-slate-700 border-slate-200",
      };
    }

    const overdueTasks = selectedRow.tasksOverdue || 0;
    const todayTasks = selectedRow.tasksToday || 0;
    const overdueEvents = controlEventsSummary.overdueCount || 0;
    const todayEvents = controlEventsSummary.todayCount || 0;
    const next7Events = controlEventsSummary.next7Count || 0;

    const totalOverdue = overdueTasks + overdueEvents;
    const totalToday = todayTasks + todayEvents;

    let level: "low" | "medium" | "high" = "low";
    let label = "Low risk";
    let description =
      "No overdue items. You are on track for this client.";
    let badgeClasses =
      "bg-emerald-50 text-emerald-800 border-emerald-200";

    if (totalOverdue > 0) {
      level = "high";
      label = "High risk";
      description =
        "There are overdue tasks or control events. This client needs immediate attention.";
      badgeClasses = "bg-red-50 text-red-800 border-red-200";
    } else if (totalToday > 0 || next7Events > 0) {
      level = "medium";
      label = "Medium risk";
      description =
        "There are items due today or in the next few days. Plan work for this client.";
      badgeClasses = "bg-amber-50 text-amber-800 border-amber-200";
    }

    return { level, label, description, badgeClasses };
  }, [selectedRow, controlEventsSummary]);

  const handleOpenTasks = (clientCode: string) => {
    const url = `/tasks?client_code=${encodeURIComponent(clientCode)}`;
    window.location.href = url;
  };

  const handleOpenControlEvents = (clientCode: string) => {
    const url = `/control-events?client_id=${encodeURIComponent(
      clientCode
    )}`;
    window.location.href = url;
  };

  const handleOpenCoverage = (clientCode: string) => {
    const url = `/process-coverage?client_code=${encodeURIComponent(
      clientCode
    )}`;
    window.location.href = url;
  };

  const handleOpenReglement = (_clientCode: string) => {
    // Send to root route where Reglement overview lives; avoid unknown paths.
    window.location.href = "/";
  };

  const riskTone: StatusPillTone =
    riskSummary.level === "high"
      ? "danger"
      : riskSummary.level === "medium"
      ? "warning"
      : "success";

  return (
    <div className="p-4 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Client profiles
          </h1>
          <p className="text-xs text-slate-600">
            Central client registry with metrics from client profiles, tasks,
            process instances and control events (year + 3 months horizon).
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500">Search</span>
            <input
              className="h-7 w-40 rounded border border-slate-200 px-2 text-xs"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Name, code, tax..."
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500">Tax system</span>
            <input
              className="h-7 w-32 rounded border border-slate-200 px-2 text-xs"
              value={filterTaxSystem}
              onChange={(e) => setFilterTaxSystem(e.target.value)}
              placeholder="usn, osno..."
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500">Salary</span>
            <select
              className="h-7 w-28 rounded border border-slate-200 px-2 text-xs"
              value={filterHasSalary}
              onChange={(e) =>
                setFilterHasSalary(e.target.value as "" | "yes" | "no")
              }
            >
              <option value="">All</option>
              <option value="yes">With salary</option>
              <option value="no">Without salary</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-500">Activity</span>
            <select
              className="h-7 w-28 rounded border border-slate-200 px-2 text-xs"
              value={filterActive}
              onChange={(e) =>
                setFilterActive(
                  e.target.value as "" | "active" | "inactive"
                )
              }
            >
              <option value="">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
          <div className="flex flex-col rounded-md border border-slate-200 bg-slate-50 px-3 py-1">
            <span className="text-[10px] text-slate-500">Clients total</span>
            <span className="text-sm font-semibold text-slate-900">
              {stats.total}
            </span>
          </div>
        </div>
      </header>

      {loading && (
        <div className="text-xs text-slate-500">
          Loading client profiles, tasks and instances...
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="text-xs text-slate-500">
          No client profiles loaded from /api/internal/client-profiles.
        </div>
      )}

      {filteredRows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left: clients list */}
          <SectionCard title="Clients" subtitle="Sorted by risk and workload.">
            <div className="mb-2 grid grid-cols-5 gap-2 text-[10px] text-slate-500">
              <div>Client</div>
              <div>Tax</div>
              <div className="text-right">Tasks total</div>
              <div className="text-right">Overdue</div>
              <div className="text-right">Today</div>
            </div>
            <div className="max-h-[420px] space-y-1 overflow-auto">
              {filteredRows.map((row) => {
                const isActiveRow = selectedClientCode === row.clientCode;
                const rowClass = isActiveRow
                  ? "bg-emerald-50"
                  : "hover:bg-slate-50";
                const secondaryText = isActiveRow
                  ? "text-[10px] text-emerald-700"
                  : "text-[10px] text-slate-500";
                const badgeClass =
                  row.tasksOverdue > 0
                    ? "bg-red-50 text-red-700"
                    : row.tasksToday > 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-50 text-slate-500";

                return (
                  <button
                    key={row.clientCode}
                    type="button"
                    className={
                      "grid w-full grid-cols-5 gap-2 rounded-md px-2 py-1.5 text-[11px] text-left " +
                      rowClass
                    }
                    onClick={() => setSelectedClientCode(row.clientCode)}
                  >
                    <div>
                      <div className="truncate font-medium text-slate-900">
                        {row.clientLabel}
                      </div>
                      <div className={secondaryText}>{row.clientCode}</div>
                      {row.salaryDays && (
                        <div className={secondaryText}>
                          Salary days: {row.salaryDays}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center text-xs">
                      {row.taxSystem || "-"}
                    </div>
                    <div className="flex items-center justify-end">
                      {row.tasksTotal}
                    </div>
                    <div className="flex items-center justify-end">
                      <span className={"rounded px-1 " + badgeClass}>
                        {row.tasksOverdue}
                      </span>
                    </div>
                    <div className="flex items-center justify-end">
                      {row.tasksToday}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Right: client cockpit */}
          <div className="space-y-4">
            <SectionCard
              title="Client card"
              subtitle="Static profile data and navigation."
              actions={
                selectedRow && (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                      onClick={() => handleOpenTasks(selectedRow.clientCode)}
                    >
                      Tasks
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                      onClick={() =>
                        handleOpenControlEvents(selectedRow.clientCode)
                      }
                    >
                      Events
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                      onClick={() =>
                        handleOpenCoverage(selectedRow.clientCode)
                      }
                    >
                      Coverage
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 hover:bg-slate-100"
                      onClick={() =>
                        handleOpenReglement(selectedRow.clientCode)
                      }
                    >
                      Reglement
                    </button>
                    <button
                      type="button"
                      className="text-emerald-700 hover:underline"
                      onClick={() => setShowRaw((v) => !v)}
                    >
                      {showRaw ? "Hide raw" : "Show raw"}
                    </button>
                  </div>
                )
              }
            >
              {!selectedRow && (
                <div className="text-xs text-slate-500">
                  Select a client in the list to open the cockpit.
                </div>
              )}
              {selectedRow && (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-500">
                      Client label
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedRow.clientLabel} · {selectedRow.clientCode}
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Tax system
                      </div>
                      <div className="text-sm text-slate-900">
                        {selectedRow.taxSystem || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Active
                      </div>
                      <div className="text-sm text-slate-900">
                        {selectedRow.isActive ? "yes" : "no"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Salary days
                      </div>
                      <div className="text-sm text-slate-900">
                        {selectedRow.salaryDays || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">
                        Last reglement
                      </div>
                      <div className="text-sm text-slate-900">
                        {selectedRow.lastReglementPeriod ? (
                          <>
                            <span>{selectedRow.lastReglementPeriod}</span>
                            <span className="ml-1 rounded-full border px-2 py-0.5 text-[10px]">
                              {getStatusLabel(selectedRow.lastReglementStatus)}
                            </span>
                          </>
                        ) : (
                          "No reglement instances"
                        )}
                      </div>
                    </div>
                  </div>
                  {showRaw && (
                    <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-emerald-50">
                      {formatJson(selectedRow.profile)}
                    </pre>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Risk and compliance"
              subtitle="Combined view of overdue and near-term events and tasks."
            >
              <div className="flex items-center gap-3">
                <StatusPill tone={riskTone} label={riskSummary.label} />
                <p className="text-xs text-slate-600">
                  {riskSummary.description}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">
                    Tasks overdue
                  </div>
                  <div className="text-base font-semibold text-red-600">
                    {selectedRow?.tasksOverdue ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">
                    Tasks today
                  </div>
                  <div className="text-base font-semibold">
                    {selectedRow?.tasksToday ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">
                    Events overdue
                  </div>
                  <div className="text-base font-semibold text-red-600">
                    {controlEventsSummary.overdueCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">
                    Events next 7d
                  </div>
                  <div className="text-base font-semibold">
                    {controlEventsSummary.next7Count}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Nearest control events"
              subtitle="Important deadlines for this client (overdue, today, next 7 days)."
            >
              {controlEventsLoading && (
                <div className="text-xs text-slate-500">Loading...</div>
              )}
              {controlEventsError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {controlEventsError}
                </div>
              )}
              {!controlEventsLoading &&
                !controlEventsError &&
                controlEventsSummary.total === 0 && (
                  <div className="text-xs text-slate-500">
                    No control events found for this client in the next
                    periods.
                  </div>
                )}
              {!controlEventsLoading &&
                !controlEventsError &&
                controlEventsSummary.total > 0 && (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Overdue
                        </div>
                        <div className="text-sm font-semibold text-red-600">
                          {controlEventsSummary.overdueCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Today
                        </div>
                        <div className="text-sm font-semibold">
                          {controlEventsSummary.todayCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Next 7 days
                        </div>
                        <div className="text-sm font-semibold">
                          {controlEventsSummary.next7Count}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">
                          Later (up to 3 months)
                        </div>
                        <div className="text-sm font-semibold">
                          {controlEventsSummary.futureCount}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <HorizonList items={nearestEventsItems} />
                    </div>
                  </div>
                )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfilePage;