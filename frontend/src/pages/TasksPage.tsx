import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";

type Task = {
  id?: string;
  task_id?: string;
  title?: string;
  description?: string;
  client_code?: string;
  client_id?: string;
  client_label?: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
  deadline?: string | null;
  planned_date?: string | null;
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

type BucketKey = "overdue" | "today" | "next7" | "future" | "no_deadline";

type EnrichedTask = Task & {
  _id: string;
  _clientCode: string;
  _dueDate: Date | null;
  _dueDateStr: string | null;
  _diffDays: number | null;
  _bucket: BucketKey;
};

function extractTasks(data: TasksResponse): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).tasks)) return (data as any).tasks as Task[];
  if (Array.isArray((data as any).items)) return (data as any).items as Task[];
  return [];
}

function parseIsoDateLike(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
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

const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [bucketFilter, setBucketFilter] = useState<
    "" | "overdue" | "today" | "next7" | "future"
  >("");

  // Read query parameters from URL (client_code, status, view)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const clientCode = params.get("client_code");
    const status = params.get("status");
    const view = params.get("view") as
      | "overdue"
      | "today"
      | "next7"
      | "future"
      | null;

    if (clientCode) {
      setClientFilter(clientCode);
    }
    if (status) {
      setStatusFilter(status);
    }
    if (view === "overdue" || view === "today" || view === "next7" || view === "future") {
      setBucketFilter(view);
    }
  }, [location.search]);

  // Load tasks from /api/tasks
  useEffect(() => {
    let active = true;

    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      setActionError(null);

      try {
        const resp = await fetch("/api/tasks");
        if (!resp.ok) {
          throw new Error("Failed to load tasks: " + resp.status);
        }
        const json: TasksResponse = await resp.json();
        const list = extractTasks(json);
        if (!active) return;
        setTasks(list);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Unknown error while loading tasks");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadTasks();
    return () => {
      active = false;
    };
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const enrichedTasks = useMemo<EnrichedTask[]>(() => {
    return (tasks || []).map((t) => {
      const rawClient =
        (t.client_code as any) ||
        (t.client_id as any) ||
        (t.client_label as any) ||
        "";
      const clientCode = String(rawClient || "").trim();

      const dueRaw =
        (t.due_date as any) ??
        (t.deadline as any) ??
        (t.planned_date as any) ??
        null;
      const dueDate = parseIsoDateLike(dueRaw);
      const dueDateStr = dueDate ? getDateOnlyString(dueDate) : null;

      let diff: number | null = null;
      let bucket: BucketKey = "no_deadline";
      if (dueDate) {
        diff = getDateDiffInDays(dueDate, today);
        if (diff < 0) bucket = "overdue";
        else if (diff === 0) bucket = "today";
        else if (diff > 0 && diff <= 7) bucket = "next7";
        else bucket = "future";
      }

      const rawId =
        (t.id as any) ??
        (t.task_id as any) ??
        (t as any).uuid ??
        (t as any).code ??
        "";
      const id = String(
        rawId || clientCode || t.title || Math.random().toString(36).slice(2)
      );

      return {
        ...t,
        _id: id,
        _clientCode: clientCode,
        _dueDate: dueDate,
        _dueDateStr: dueDateStr,
        _diffDays: diff,
        _bucket: bucket,
      };
    });
  }, [tasks, today]);

  const filteredTasks = useMemo(() => {
    return enrichedTasks.filter((t) => {
      if (bucketFilter && t._bucket !== bucketFilter) {
        return false;
      }
      if (statusFilter) {
        const s = (t.status || "").toLowerCase();
        if (s !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      if (clientFilter) {
        const code = t._clientCode.toLowerCase();
        if (!code.includes(clientFilter.toLowerCase())) {
          return false;
        }
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const haystack =
          (t.title || "").toLowerCase() +
          " " +
          (t.description || "").toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedTasks, bucketFilter, statusFilter, clientFilter, searchText]);

  const grouped = useMemo(() => {
    const byBucket: Record<BucketKey, EnrichedTask[]> = {
      overdue: [],
      today: [],
      next7: [],
      future: [],
      no_deadline: [],
    };

    for (const t of filteredTasks) {
      byBucket[t._bucket].push(t);
    }

    (Object.keys(byBucket) as BucketKey[]).forEach((key) => {
      byBucket[key].sort((a, b) => {
        const da = a._dueDateStr || "";
        const db = b._dueDateStr || "";
        if (da && db && da !== db) {
          return da < db ? -1 : 1;
        }
        const pa = (a.priority || "").toString();
        const pb = (b.priority || "").toString();
        if (pa && pb && pa !== pb) {
          return pa < pb ? -1 : 1;
        }
        return (a.title || "").localeCompare(b.title || "");
      });
    });

    const total = enrichedTasks.length;
    const overdueCount = byBucket.overdue.length;
    const todayCount = byBucket.today.length;
    const next7Count = byBucket.next7.length;
    const futureCount = byBucket.future.length;
    const withoutDeadlineCount = byBucket.no_deadline.length;

    return {
      byBucket,
      total,
      overdueCount,
      todayCount,
      next7Count,
      futureCount,
      withoutDeadlineCount,
    };
  }, [filteredTasks, enrichedTasks]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.status) set.add(t.status);
    });
    return Array.from(set).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }, [tasks]);

  const handleOpenTask = (task: EnrichedTask) => {
    const taskId =
      (task.id as any) ??
      (task.task_id as any) ??
      (task as any).uuid ??
      (task as any).code;
    if (!taskId) return;

    const params = new URLSearchParams();
    params.set("task_id", String(taskId));

    if (task.event_id) {
      params.set("event_id", String(task.event_id));
    }
    if (task._clientCode) {
      params.set("client_code", String(task._clientCode));
    }

    navigate(`/task-detail?${params.toString()}`);
  };

  const handleChangeStatus = async (task: EnrichedTask, newStatus: string) => {
    const taskId =
      (task.id as any) ??
      (task.task_id as any) ??
      (task as any).uuid ??
      (task as any).code;
    if (!taskId) return;

    setActionError(null);

    try {
      const resp = await fetch(
        `/api/tasks/${encodeURIComponent(String(taskId))}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!resp.ok) {
        throw new Error("Failed to update task status: " + resp.status);
      }

      setTasks((prev) =>
        (prev || []).map((t) => {
          const currentId =
            (t.id as any) ??
            (t.task_id as any) ??
            (t as any).uuid ??
            (t as any).code;
          if (String(currentId) !== String(taskId)) return t;
          return { ...t, status: newStatus };
        })
      );
    } catch (e: any) {
      setActionError(e?.message || "Failed to update task status");
    }
  };

  const renderBucketSection = (
    key: BucketKey,
    title: string,
    subtitle: string,
    items: EnrichedTask[]
  ) => {
    return (
      <SectionCard key={key} title={title} subtitle={subtitle}>
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">No tasks in this group.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((t) => {
              const status = (t.status || "new").toString();
              const priority = t.priority || "";
              const dueLabel = t._dueDateStr
                ? `Due ${t._dueDateStr}`
                : "No due date";
              const clientLabel =
                t.client_label ||
                t._clientCode ||
                t.client_code ||
                t.client_id ||
                "-";

              const isCompleted =
                status.toLowerCase() === "completed" ||
                status.toLowerCase() === "done";

              return (
                <li
                  key={t._id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-white p-2 text-xs shadow-sm"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="truncate text-left text-[13px] font-medium text-slate-900 hover:text-emerald-700"
                        onClick={() => handleOpenTask(t)}
                      >
                        {t.title || t._id}
                      </button>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {clientLabel}
                      </span>
                    </div>
                    {t.description && (
                      <p className="line-clamp-2 text-[11px] text-slate-500">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
                        {status}
                      </span>
                      {priority && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                          Priority: {priority}
                        </span>
                      )}
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] " +
                          (t._bucket === "overdue"
                            ? "bg-red-50 text-red-700"
                            : t._bucket === "today"
                            ? "bg-emerald-50 text-emerald-700"
                            : t._bucket === "next7"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-50 text-slate-600")
                        }
                      >
                        {dueLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[10px]">
                    {!isCompleted && (
                      <button
                        type="button"
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-100"
                        onClick={() => handleChangeStatus(t, "completed")}
                      >
                        Mark done
                      </button>
                    )}
                    {isCompleted && (
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() => handleChangeStatus(t, "new")}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Tasks board</h1>
          <p className="text-sm text-slate-500">
            All tasks from /api/tasks grouped by urgency and ready for the working day.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Total: {grouped.total}</div>
          <div>Today: {grouped.todayCount}</div>
          <div>Overdue: {grouped.overdueCount}</div>
        </div>
      </div>

      <SectionCard title="Filters" subtitle="Narrow down the tasks list.">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-[11px] text-slate-500">Search</label>
            <input
              className="h-7 rounded-md border border-slate-200 px-2 text-xs"
              placeholder="Search in title or description..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-[11px] text-slate-500">Status</label>
            <select
              className="h-7 rounded-md border border-slate-200 px-2 text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-[11px] text-slate-500">Client code</label>
            <input
              className="h-7 rounded-md border border-slate-200 px-2 text-xs"
              placeholder="Filter by client code..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1 text-xs">
            <label className="text-[11px] text-slate-500">Group</label>
            <select
              className="h-7 rounded-md border border-slate-200 px-2 text-xs"
              value={bucketFilter}
              onChange={(e) =>
                setBucketFilter(
                  e.target.value as "" | "overdue" | "today" | "next7" | "future"
                )
              }
            >
              <option value="">All</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="next7">Next 7 days</option>
              <option value="future">Future</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {loading && (
        <div className="text-sm text-slate-500">Loading tasks...</div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionError && !error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {actionError}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 xl:grid-cols-2">
          {renderBucketSection(
            "overdue",
            "Overdue",
            "Tasks with due date before today.",
            grouped.byBucket.overdue
          )}
          {renderBucketSection(
            "today",
            "Today",
            "Tasks that are due today.",
            grouped.byBucket.today
          )}
          {renderBucketSection(
            "next7",
            "Next 7 days",
            "Tasks that are due in the next 7 days.",
            grouped.byBucket.next7
          )}
          {renderBucketSection(
            "future",
            "Future",
            "Tasks with due dates more than 7 days ahead.",
            grouped.byBucket.future
          )}
          {renderBucketSection(
            "no_deadline",
            "No due date",
            "Tasks without explicit due date.",
            grouped.byBucket.no_deadline
          )}
        </div>
      )}
    </div>
  );
};

export default TasksPage;
