import React, { useEffect, useMemo, useState } from "react";

type Task = any;
type ProcessDefinition = any;
type ProcessInstance = any;

type LoadState = "idle" | "loading" | "ready" | "error";
type TaskFilter = "all" | "done" | "in_progress" | "overdue";
type TaskAction = "start" | "done" | "postpone";

const CLIENT_PROFILE_FOCUS_KEY = "erpv2_client_profile_focus";
const TASKS_FOCUS_KEY = "erpv2_tasks_focus";

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatMonthInputValue(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

const STATUS_DONE = ["done", "completed", "closed", "finished"];
const STATUS_IN_PROGRESS = ["in_progress", "in-progress", "progress", "started"];

export default function ClientProfilePage() {
  const [clientId, setClientId] = useState<string>("client_demo_01");
  const [baseDate, setBaseDate] = useState<Date>(() =>
    startOfMonth(new Date())
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [processDefinitions, setProcessDefinitions] = useState<
    ProcessDefinition[]
  >([]);
  const [processInstances, setProcessInstances] = useState<ProcessInstance[]>(
    []
  );
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(
    null
  );
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");

  const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(
    null
  );

  const periodStart = useMemo(() => startOfMonth(baseDate), [baseDate]);
  const periodEnd = useMemo(() => endOfMonth(baseDate), [baseDate]);

  // apply focus from Internal processes or Tasks (client + month)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CLIENT_PROFILE_FOCUS_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        const client =
          typeof data.clientId === "string" ? data.clientId : undefined;
        const month = typeof data.month === "string" ? data.month : undefined;

        if (client) {
          setClientId(client);
        }

        if (month) {
          let parsed: Date | null = null;
          if (/^\d{4}-\d{2}$/.test(month)) {
            const [y, m] = month.split("-");
            parsed = new Date(Number(y), Number(m) - 1, 1);
          } else {
            const d = new Date(month);
            if (!Number.isNaN(d.getTime())) {
              parsed = d;
            }
          }
          if (parsed) {
            setBaseDate(startOfMonth(parsed));
          }
        }
      }
    } catch (e) {
      console.error("Failed to apply focus from storage", e);
    } finally {
      try {
        window.localStorage.removeItem(CLIENT_PROFILE_FOCUS_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const [tasksRes, defsRes, instRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/internal/process-definitions"),
        fetch("/api/internal/process-instances"),
      ]);

      if (!tasksRes.ok || !defsRes.ok || !instRes.ok) {
        throw new Error("Failed to load client profile data");
      }

      const [tasksJson, defsJson, instJson] = await Promise.all([
        tasksRes.json(),
        defsRes.json(),
        instRes.json(),
      ]);

      setTasks(Array.isArray(tasksJson) ? tasksJson : tasksJson?.items ?? []);
      setProcessDefinitions(
        Array.isArray(defsJson) ? defsJson : defsJson?.items ?? []
      );
      setProcessInstances(
        Array.isArray(instJson) ? instJson : instJson?.items ?? []
      );

      setState("ready");
    } catch (e: any) {
      console.error("ClientProfilePage load error:", e);
      setError(e?.message ?? "Unknown error");
      setState("error");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function shiftMonth(delta: number) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + delta);
    setBaseDate(startOfMonth(d));
  }

  function getTaskDueRaw(t: any): string | null {
    const raw = t.due_date ?? t.dueDate ?? t.due ?? t.deadline ?? null;
    return raw ?? null;
  }

  function getTaskStatus(t: any): string {
    return (t.status ?? t.state ?? "unknown").toString();
  }

  function getTaskStatusNormalized(t: any): string {
    return getTaskStatus(t).toLowerCase();
  }

  function isTaskOverdue(t: any): boolean {
    const raw = getTaskDueRaw(t);
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;

    const statusRaw = getTaskStatusNormalized(t);
    if (STATUS_DONE.includes(statusRaw)) return false;

    return d.getTime() < Date.now();
  }

  function getTaskId(t: any): string | null {
    const raw = t.id ?? t.task_id ?? t.code ?? null;
    if (raw === null || raw === undefined) return null;
    return String(raw);
  }

  const filteredTasks = useMemo(() => {
    if (!clientId.trim()) return [];

    const startTs = periodStart.getTime();
    const endTs = periodEnd.getTime();

    return tasks.filter((t: any) => {
      const tClientId = (t.client_id ?? t.clientId ?? "").toString();
      if (!tClientId || tClientId !== clientId.trim()) {
        return false;
      }

      const rawDue = getTaskDueRaw(t);
      if (!rawDue) return false;

      const ts = new Date(rawDue).getTime();
      if (Number.isNaN(ts)) return false;

      return ts >= startTs && ts <= endTs;
    });
  }, [clientId, periodStart, periodEnd, tasks]);

  const tasksByProcess = useMemo(() => {
    const map: Record<string, Task[]> = {};

    for (const t of filteredTasks) {
      const processId = (t.process_id ??
        t.processId ??
        t.process_definition_id ??
        t.processDefinitionId ??
        "") as string;

      const pid = processId?.toString() || "unknown";
      if (!map[pid]) {
        map[pid] = [];
      }
      map[pid].push(t);
    }

    return map;
  }, [filteredTasks]);

  const definitionById = useMemo(() => {
    const map: Record<string, ProcessDefinition> = {};
    for (const d of processDefinitions) {
      const id = (d.id ??
        d.definition_id ??
        d.process_definition_id ??
        d.code ??
        "")?.toString() ?? "";
      if (!id) continue;
      map[id] = d;
    }
    return map;
  }, [processDefinitions]);

  const instanceById = useMemo(() => {
    const map: Record<string, ProcessInstance> = {};
    for (const inst of processInstances) {
      const id = (inst.id ??
        inst.instance_id ??
        inst.process_instance_id ??
        inst.processId ??
        "")?.toString() ?? "";
      if (!id) continue;
      map[id] = inst;
    }
    return map;
  }, [processInstances]);

  const processNameById = useMemo(() => {
    const map: Record<string, string> = {};

    for (const inst of processInstances) {
      const instanceId = (inst.id ??
        inst.instance_id ??
        inst.process_instance_id ??
        inst.processId ??
        "")?.toString() ?? "";
      if (!instanceId) continue;

      const defId = (inst.definition_id ??
        inst.process_definition_id ??
        inst.definitionId ??
        "")?.toString() ?? "";
      const def = defId ? definitionById[defId] : undefined;

      const baseName = (
        def?.name ??
        def?.title ??
        def?.process_name ??
        "Process"
      ).toString();

      const period = (inst.period ?? inst.month ?? "").toString();
      const client = (inst.client_id ?? inst.clientId ?? "").toString();

      let name = baseName;
      if (period) {
        name += ` / ${period}`;
      }
      if (client) {
        name += ` / ${client}`;
      }

      map[instanceId] = name;
    }

    return map;
  }, [processInstances, definitionById]);

  const processDescriptionById = useMemo(() => {
    const map: Record<string, string> = {};

    for (const inst of processInstances) {
      const instanceId = (inst.id ??
        inst.instance_id ??
        inst.process_instance_id ??
        inst.processId ??
        "")?.toString() ?? "";
      if (!instanceId) continue;

      const status = (inst.status ?? inst.state ?? "").toString();
      const notes = (inst.notes ?? inst.comment ?? "").toString();

      const defId = (inst.definition_id ??
        inst.process_definition_id ??
        inst.definitionId ??
        "")?.toString() ?? "";
      const def = defId ? definitionById[defId] : undefined;
      const defDesc = (def?.description ?? def?.notes ?? "").toString();

      const parts: string[] = [];
      if (status) {
        parts.push(`Status: ${status}`);
      }
      if (defDesc) {
        parts.push(defDesc);
      }
      if (notes) {
        parts.push(notes);
      }

      if (parts.length > 0) {
        map[instanceId] = parts.join(" · ");
      }
    }

    return map;
  }, [processInstances, definitionById]);

  const matrix = useMemo(() => {
    const rows: {
      processId: string;
      processName: string;
      processDescription?: string;
      total: number;
      done: number;
      inProgress: number;
      overdue: number;
      progress: number;
      statusLabel: string;
      statusDotClass: string;
      statusTextClass: string;
    }[] = [];

    function getFallbackProcessName(
      procId: string,
      procTasks: Task[]
    ): string {
      for (const t of procTasks) {
        const candidate = (t.process_name ??
          t.processName ??
          t.process ??
          t.definition_name ??
          t.definitionName ??
          "") as string;
        if (candidate) {
          return candidate;
        }
      }
      return `Process ${procId}`;
    }

    for (const [procId, procTasks] of Object.entries(tasksByProcess)) {
      const total = procTasks.length;

      let done = 0;
      let inProgress = 0;
      let overdue = 0;

      for (const t of procTasks) {
        const statusNorm = getTaskStatusNormalized(t);

        if (STATUS_DONE.includes(statusNorm)) {
          done += 1;
        } else {
          inProgress += 1;
        }

        if (isTaskOverdue(t)) {
          overdue += 1;
        }
      }

      const progress = total > 0 ? Math.round((done / total) * 100) : 0;

      const processName =
        processNameById[procId] || getFallbackProcessName(procId, procTasks);

      const processDescription = processDescriptionById[procId];

      let statusLabel = "No tasks";
      let statusDotClass = "bg-gray-300";
      let statusTextClass = "text-gray-500";

      if (total > 0) {
        if (overdue > 0) {
          statusLabel = "Critical";
          statusDotClass = "bg-red-500";
          statusTextClass = "text-red-700";
        } else if (progress >= 80) {
          statusLabel = "Good";
          statusDotClass = "bg-emerald-500";
          statusTextClass = "text-emerald-700";
        } else {
          statusLabel = "Warning";
          statusDotClass = "bg-amber-500";
          statusTextClass = "text-amber-700";
        }
      }

      rows.push({
        processId: procId,
        processName,
        processDescription,
        total,
        done,
        inProgress,
        overdue,
        progress,
        statusLabel,
        statusDotClass,
        statusTextClass,
      });
    }

    rows.sort((a, b) => {
      if (a.overdue !== b.overdue) {
        return b.overdue - a.overdue;
      }
      if (a.total !== b.total) {
        return b.total - a.total;
      }
      return a.processName.localeCompare(b.processName);
    });

    return rows;
  }, [tasksByProcess, processNameById, processDescriptionById]);

  const totals = useMemo(() => {
    const total = filteredTasks.length;

    const done = filteredTasks.filter((t: any) =>
      STATUS_DONE.includes(getTaskStatusNormalized(t))
    ).length;

    const inProgress = total - done;

    const overdue = filteredTasks.filter((t: any) => isTaskOverdue(t)).length;

    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, inProgress, overdue, progress };
  }, [filteredTasks]);

  const selectedProcessRow = useMemo(() => {
    if (!selectedProcessId) return null;
    return matrix.find((row) => row.processId === selectedProcessId) ?? null;
  }, [selectedProcessId, matrix]);

  const tasksForSelectedProcessBase = useMemo(() => {
    if (!selectedProcessId) return [];
    const list = tasksByProcess[selectedProcessId] ?? [];
    return [...list].sort((a: any, b: any) => {
      const aDueRaw = getTaskDueRaw(a);
      const bDueRaw = getTaskDueRaw(b);

      const aDue = aDueRaw
        ? new Date(aDueRaw).getTime()
        : Number.POSITIVE_INFINITY;
      const bDue = bDueRaw
        ? new Date(bDueRaw).getTime()
        : Number.POSITIVE_INFINITY;

      if (Number.isNaN(aDue) && Number.isNaN(bDue)) return 0;
      if (Number.isNaN(aDue)) return 1;
      if (Number.isNaN(bDue)) return -1;

      return aDue - bDue;
    });
  }, [selectedProcessId, tasksByProcess]);

  const tasksForSelectedProcess = useMemo(() => {
    if (taskFilter === "all") {
      return tasksForSelectedProcessBase;
    }

    return tasksForSelectedProcessBase.filter((t: any) => {
      const statusNorm = getTaskStatusNormalized(t);

      if (taskFilter === "done") {
        return STATUS_DONE.includes(statusNorm);
      }
      if (taskFilter === "in_progress") {
        return !STATUS_DONE.includes(statusNorm);
      }
      if (taskFilter === "overdue") {
        return isTaskOverdue(t);
      }
      return true;
    });
  }, [tasksForSelectedProcessBase, taskFilter]);

  function getTaskTitle(t: any): string {
    return (
      t.title ??
      t.name ??
      t.summary ??
      t.code ??
      `Task #${t.id ?? ""}` ??
      "Task"
    ).toString();
  }

  function getTaskAssignee(t: any): string {
    return (
      t.assignee ??
      t.executor ??
      t.owner ??
      t.assigned_to ??
      t.assignedTo ??
      ""
    ).toString();
  }

  function getTaskDueFormatted(t: any): string {
    const raw = getTaskDueRaw(t);
    if (!raw) return "";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  }

  function getTaskProcessName(t: any): string {
    const pid = (t.process_id ??
      t.processId ??
      t.process_definition_id ??
      t.processDefinitionId ??
      "")?.toString() ?? "";

    if (pid && processNameById[pid]) {
      return processNameById[pid];
    }

    return (t.process_name ?? t.processName ?? t.process ?? "").toString();
  }

  function renderTaskFilterButton(id: TaskFilter, label: string) {
    const isActive = taskFilter === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTaskFilter(id)}
        className={
          "px-2.5 py-1 text-xs rounded-full border " +
          (isActive
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50")
        }
      >
        {label}
      </button>
    );
  }

  function getProcessStatusTextColor(label: string): string {
    if (label === "Good") return "text-emerald-700";
    if (label === "Critical") return "text-red-700";
    if (label === "Warning") return "text-amber-700";
    return "text-gray-600";
  }

  function getTaskStatusTextColor(t: any): string {
    const statusNorm = getTaskStatusNormalized(t);
    const overdue = isTaskOverdue(t);

    if (STATUS_DONE.includes(statusNorm)) return "text-emerald-700";
    if (overdue) return "text-red-700";
    if (STATUS_IN_PROGRESS.includes(statusNorm)) return "text-blue-700";
    return "text-gray-600";
  }

  async function performTaskActionById(
    taskId: string,
    action: TaskAction
  ): Promise<void> {
    const encodedId = encodeURIComponent(taskId);

    const endpoint =
      action === "done" ? "mark-done" : action === "postpone" ? "postpone" : "start";

    const url = `/api/tasks/${encodedId}/${endpoint}`;

    let options: RequestInit = { method: "POST" };

    if (endpoint === "postpone") {
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 1 }),
      };
    }

    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Action failed (${res.status}): ${text || "request not ok"}`
      );
    }
  }

  async function handleTaskAction(t: any, action: TaskAction) {
    const id = getTaskId(t);
    if (!id) {
      console.warn("Task has no id, action skipped", t);
      return;
    }

    try {
      setActionLoadingTaskId(id);
      await performTaskActionById(id, action);
      await loadData();
    } catch (err) {
      console.error("Task action error:", err);
    } finally {
      setActionLoadingTaskId(null);
    }
  }

  const periodLabel = `${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Client profile
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Overview of internal processes and tasks for a single client for
              the selected month.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  try {
                    const monthKey = formatMonthInputValue(baseDate);
                    const payload = {
                      clientId: clientId.trim(),
                      month: monthKey,
                      mode: "all" as const,
                    };
                    window.localStorage.setItem(
                      TASKS_FOCUS_KEY,
                      JSON.stringify(payload)
                    );
                  } catch (e) {
                    console.error("Failed to store tasks focus", e);
                  }

                  window.dispatchEvent(
                    new CustomEvent("erpv2_navigate", {
                      detail: { tab: "tasks" },
                    })
                  );
                }
              }}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50"
            >
              Go to tasks
            </button>
            {state === "loading" && (
              <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-full">
                Loading data.
              </span>
            )}
            <button
              type="button"
              onClick={loadData}
              disabled={state === "loading"}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              {state === "loading" ? "Reloading data" : "Reload data"}
            </button>
          </div>
        </header>

        {/* error */}
        {state === "error" && error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            <div className="font-semibold mb-0.5">Failed to load data</div>
            <div>{error}</div>
          </div>
        )}

        {/* 1. Filters + summary + matrix + tasks */}
        <section className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                1. Filters and summary
              </div>
              <div className="text-[11px] text-gray-500">
                Period: {periodLabel}
              </div>
            </div>

            {/* filters */}
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-end">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-gray-700">
                  Filters
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] uppercase tracking-wide text-gray-500">
                    Client ID
                  </label>
                  <input
                    type="text"
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm font-mono"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="client_id"
                  />
                  <p className="text-[11px] text-gray-500">
                    Tasks are filtered by{" "}
                    <span className="font-mono">client_id</span> field (with
                    fallbacks).
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase tracking-wide text-gray-500">
                    Month
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {periodLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
                  >
                    {"<"}
                  </button>
                  <input
                    type="month"
                    value={formatMonthInputValue(baseDate)}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) return;
                      const [y, m] = value.split("-");
                      const d = new Date(Number(y), Number(m) - 1, 1);
                      if (!Number.isNaN(d.getTime())) {
                        setBaseDate(startOfMonth(d));
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
                  >
                    {">"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* totals */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-gray-800 uppercase">
                Summary for selected client and month
              </h2>
              <span className="text-[11px] text-gray-500">
                Total progress:{" "}
                <span className="font-semibold text-gray-900">
                  {totals.progress}%
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  Total tasks
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {totals.total}
                </div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-emerald-700">
                  Done
                </div>
                <div className="mt-1 text-lg font-semibold text-emerald-700">
                  {totals.done}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-blue-700">
                  In progress
                </div>
                <div className="mt-1 text-lg font-semibold text-blue-700">
                  {totals.inProgress}
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                <div className="text-[11px] uppercase tracking-wide text-red-700">
                  Overdue
                </div>
                <div className="mt-1 text-lg font-semibold text-red-700">
                  {totals.overdue}
                </div>
              </div>
            </div>
          </div>

          {/* matrix + tasks */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* matrix */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                2. Processes matrix
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">
                      Processes matrix
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      One row per process with statistics for the selected
                      client and month.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500">
                      Selected client:
                    </div>
                    <div className="text-xs font-medium text-gray-800">
                      {clientId.trim() || "not set"}
                    </div>
                  </div>
                </div>

                {clientId.trim() === "" ? (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    Enter a <span className="font-mono">client_id</span> to see
                    matrix data.
                  </div>
                ) : matrix.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500">
                    No tasks found for this client and period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500 uppercase">
                            Process
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-gray-500 uppercase">
                            Total
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-gray-500 uppercase">
                            Done
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-gray-500 uppercase">
                            In progress
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-gray-500 uppercase">
                            Overdue
                          </th>
                          <th className="text-right px-3 py-2 font-medium text-xs text-gray-500 uppercase">
                            Progress
                          </th>
                          <th className="text-left px-3 py-2 font-medium text-xs text-gray-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map((row) => {
                          const isSelected =
                            selectedProcessId === row.processId;
                          const statusTextClass = getProcessStatusTextColor(
                            row.statusLabel
                          );

                          return (
                            <tr
                              key={row.processId}
                              className={
                                "border-b border-gray-100 cursor-pointer " +
                                (isSelected
                                  ? "bg-blue-50/60"
                                  : "hover:bg-gray-50")
                              }
                              onClick={() =>
                                setSelectedProcessId(row.processId)
                              }
                            >
                              <td className="px-4 py-2.5">
                                <div className="text-sm font-medium text-gray-900">
                                  {row.processName}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-0.5">
                                  <span className="font-mono">
                                    {row.processId}
                                  </span>
                                  {row.processDescription && (
                                    <>
                                      {" "}
                                      · {row.processDescription}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm text-gray-800">
                                {row.total}
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm text-emerald-700">
                                {row.done}
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm text-blue-700">
                                {row.inProgress}
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm text-red-700">
                                {row.overdue}
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm text-gray-800">
                                {row.progress}%
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="inline-flex items-center gap-1.5 text-xs">
                                  <span
                                    className={
                                      "inline-block w-2 h-2 rounded-full " +
                                      row.statusDotClass
                                    }
                                  />
                                  <span className={statusTextClass}>
                                    {row.statusLabel}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* tasks for selected process */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                3. Tasks for selected process
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col max-h-[540px]">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">
                      {selectedProcessRow
                        ? selectedProcessRow.processName
                        : "Tasks for selected process"}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Tasks for the selected process instance and period.
                    </p>
                    {selectedProcessRow && (
                      <div className="mt-1 text-[11px] text-gray-500 flex flex-wrap gap-3">
                        <span>
                          Total:{" "}
                          <span className="font-semibold text-gray-900">
                            {selectedProcessRow.total}
                          </span>
                        </span>
                        <span>
                          Done:{" "}
                          <span className="font-semibold text-emerald-700">
                            {selectedProcessRow.done}
                          </span>
                        </span>
                        <span>
                          In progress:{" "}
                          <span className="font-semibold text-blue-700">
                            {selectedProcessRow.inProgress}
                          </span>
                        </span>
                        <span>
                          Overdue:{" "}
                          <span className="font-semibold text-red-700">
                            {selectedProcessRow.overdue}
                          </span>
                        </span>
                        <span>
                          Progress:{" "}
                          <span className="font-semibold text-gray-900">
                            {selectedProcessRow.progress}%
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {selectedProcessRow && (
                      <div className="text-[11px] text-gray-500">
                        <span className="font-semibold">Process ID:</span>{" "}
                        <span className="font-mono">
                          {selectedProcessRow.processId}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      {renderTaskFilterButton("all", "All")}
                      {renderTaskFilterButton("done", "Done")}
                      {renderTaskFilterButton("in_progress", "In progress")}
                      {renderTaskFilterButton("overdue", "Overdue")}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {!selectedProcessId ? (
                    <div className="px-4 py-6 text-sm text-gray-500">
                      Select a process in the matrix to see its tasks.
                    </div>
                  ) : tasksForSelectedProcessBase.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">
                      No tasks found for the selected process.
                    </div>
                  ) : tasksForSelectedProcess.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">
                      No tasks match the selected status filter.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {tasksForSelectedProcess.map((t: any) => {
                        const title = getTaskTitle(t);
                        const assignee = getTaskAssignee(t);
                        const due = getTaskDueFormatted(t);
                        const status = getTaskStatus(t);
                        const overdue = isTaskOverdue(t);
                        const statusColor = getTaskStatusTextColor(t);
                        const taskId = getTaskId(t);
                        const isLoading =
                          taskId !== null && actionLoadingTaskId === taskId;

                        return (
                          <li
                            key={String(
                              t.id ?? `${t.process_id ?? ""}_${t.code ?? ""}`
                            )}
                          >
                            <div className="px-4 py-3 space-y-1.5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {title}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    <span className="font-mono">
                                      #{t.id ?? "no-id"}
                                    </span>{" "}
                                    ·{" "}
                                    <span className="font-mono">
                                      {getTaskProcessName(t)}
                                    </span>
                                  </div>
                                </div>
                                <span
                                  className={
                                    "text-xs font-medium px-2 py-0.5 rounded-full border " +
                                    (overdue
                                      ? "bg-red-50 border-red-200 text-red-700"
                                      : STATUS_DONE.includes(
                                          getTaskStatusNormalized(t)
                                        )
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                      : STATUS_IN_PROGRESS.includes(
                                          getTaskStatusNormalized(t)
                                        )
                                      ? "bg-blue-50 border-blue-200 text-blue-700"
                                      : "bg-gray-50 border-gray-200 text-gray-700")
                                  }
                                >
                                  {status}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div>
                                    <span className="text-gray-500">
                                      Due:{" "}
                                    </span>
                                    <span
                                      className={
                                        overdue ? "text-red-700" : "text-gray-900"
                                      }
                                    >
                                      {due || "no deadline"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">
                                      Assignee:{" "}
                                    </span>
                                    <span className="text-gray-900">
                                      {assignee || "not set"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={!taskId || isLoading}
                                    onClick={() =>
                                      handleTaskAction(t, "start")
                                    }
                                    className="px-2 py-0.5 text-[11px] rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
                                  >
                                    Start
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!taskId || isLoading}
                                    onClick={() =>
                                      handleTaskAction(t, "postpone")
                                    }
                                    className="px-2 py-0.5 text-[11px] rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-60"
                                  >
                                    +1 day
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!taskId || isLoading}
                                    onClick={() => handleTaskAction(t, "done")}
                                    className="px-2 py-0.5 text-[11px] rounded border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60"
                                  >
                                    Done
                                  </button>
                                  {isLoading && (
                                    <span className="ml-1 text-[10px] text-gray-400">
                                      Updating...
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
