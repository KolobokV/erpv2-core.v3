import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

type TasksResponse =
  | Task[]
  | { tasks?: Task[]; items?: Task[]; [key: string]: any }
  | null
  | undefined;

function extractTasks(data: TasksResponse): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).tasks)) return (data as any).tasks as Task[];
  if (Array.isArray((data as any).items)) return (data as any).items as Task[];
  return [];
}

function formatDate(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateHuman(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const statusOptions: string[] = [
  "new",
  "planned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled"
];

const priorityOptions: string[] = ["low", "normal", "high", "urgent"];

const TaskDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const taskId = searchParams.get("task_id") || "";
  const fromEventId = searchParams.get("event_id") || "";
  const fromClientCode = searchParams.get("client_code") || "";
  const fromPeriod = searchParams.get("period") || "";

  const [task, setTask] = useState<Task | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [editableTitle, setEditableTitle] = useState<string>("");
  const [editableDescription, setEditableDescription] = useState<string>("");
  const [editableStatus, setEditableStatus] = useState<string>("");
  const [editablePriority, setEditablePriority] = useState<string>("");
  const [editableDeadline, setEditableDeadline] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let isMounted = true;

    const loadTask = async () => {
      setLoadingTask(true);
      setTaskError(null);
      setSaveMessage(null);
      setSaveError(null);

      try {
        // Try dedicated internal task endpoint first
        const respInternal = await fetch(
          `/api/internal/tasks/${encodeURIComponent(taskId)}`
        );
        if (respInternal.ok) {
          const json: Task = await respInternal.json();
          if (isMounted) {
            setTask(json);
            setEditableTitle(json.title || "");
            setEditableDescription(json.description || "");
            setEditableStatus(json.status || "");
            setEditablePriority(json.priority || "");
            setEditableDeadline(formatDate(json.deadline));
          }
          return;
        }

        // Fallback: load all tasks and filter
        const resp = await fetch("/api/tasks");
        if (!resp.ok) {
          throw new Error("Failed to load tasks: " + resp.status);
        }
        const jsonAll: TasksResponse = await resp.json();
        const list = extractTasks(jsonAll);
        const found = list.find((t) => (t.id || "").toString() === taskId.toString());
        if (!found) {
          throw new Error("Task not found in tasks store");
        }

        if (isMounted) {
          setTask(found);
          setEditableTitle(found.title || "");
          setEditableDescription(found.description || "");
          setEditableStatus(found.status || "");
          setEditablePriority(found.priority || "");
          setEditableDeadline(formatDate(found.deadline));
        }
      } catch (e: any) {
        if (isMounted) {
          setTaskError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoadingTask(false);
        }
      }
    };

    loadTask();
    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const handleSave = async () => {
    if (!taskId) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const body: any = {
        status: editableStatus,
        priority: editablePriority,
        deadline: editableDeadline || null,
        title: editableTitle,
        description: editableDescription
      };

      const resp = await fetch(`/api/internal/tasks/${encodeURIComponent(taskId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        throw new Error("Failed to update task: " + resp.status);
      }

      const updated = await resp.json().catch(() => null);
      if (updated && updated.task) {
        setTask(updated.task as Task);
      } else {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                status: editableStatus,
                priority: editablePriority,
                deadline: editableDeadline,
                title: editableTitle,
                description: editableDescription
              }
            : prev
        );
      }

      setSaveMessage("Task updated.");
    } catch (e: any) {
      setSaveError(e?.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    setEditableStatus("completed");
    await handleSave();
  };

  const handleBack = () => {
    if (fromEventId) {
      const params = new URLSearchParams();
      params.set("event_id", fromEventId);
      if (fromClientCode) params.set("client_code", fromClientCode);
      if (fromPeriod) params.set("period", fromPeriod);
      navigate(`/client-control-event?${params.toString()}`);
      return;
    }
    if (fromClientCode || fromPeriod) {
      const params = new URLSearchParams();
      if (fromClientCode) params.set("client_code", fromClientCode);
      if (fromPeriod) {
        const parts = fromPeriod.split("-");
        if (parts.length === 2) {
          params.set("year", parts[0]);
          params.set("month", parts[1]);
        }
      }
      navigate(`/reglement-overview?${params.toString()}`);
      return;
    }
    navigate(-1);
  };

  const effectiveClientCode =
    task?.client_code || task?.client_id || fromClientCode || "-";
  const effectiveClientLabel = task?.client_label || effectiveClientCode;

  const pageTitle = task
    ? task.title || task.id || "Task detail"
    : taskId
    ? `Task ${taskId}`
    : "Task detail";

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-600">
            Detail view for a single task with editable status, priority and deadline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </div>

      {!taskId && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Missing task_id in query string.
        </div>
      )}

      {taskError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Failed to load task: {taskError}
        </div>
      )}

      {saveError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          Save error: {saveError}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {saveMessage}
        </div>
      )}

      {loadingTask && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading task details...
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Task details
            </h2>
            <span className="text-xs text-slate-500">
              ID: {task?.id || taskId || "-"}
            </span>
          </div>

          {task ? (
            <div className="space-y-2 text-xs text-slate-800">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Title
                </label>
                <input
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Description
                </label>
                <textarea
                  className="min-h-[80px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                  value={editableDescription}
                  onChange={(e) => setEditableDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Client</div>
                <div>{effectiveClientLabel}</div>
              </div>

              {task.event_id && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-slate-500">Linked event</div>
                  <div>{task.event_id}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              {loadingTask ? "Loading task..." : "No task loaded."}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Status and scheduling
            </h2>
          </div>

          <div className="space-y-3 text-xs text-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">
                Status
              </label>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                value={editableStatus}
                onChange={(e) => setEditableStatus(e.target.value)}
                disabled={!taskId || saving}
              >
                <option value="">Select status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">
                Priority
              </label>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                value={editablePriority}
                onChange={(e) => setEditablePriority(e.target.value)}
                disabled={!taskId || saving}
              >
                <option value="">Select priority</option>
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">
                Deadline
              </label>
              <input
                type="date"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                value={editableDeadline}
                onChange={(e) => setEditableDeadline(e.target.value)}
                disabled={!taskId || saving}
              />
              <div className="text-[10px] text-slate-500">
                Human readable: {editableDeadline ? formatDateHuman(editableDeadline) : "-"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !taskId}
                className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save task"}
              </button>
              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={saving || !taskId}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark completed
              </button>
            </div>

            <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2 text-[11px] text-slate-600">
              This page updates tasks via /api/internal/tasks/{`{task_id}`} using
              status, priority and deadline fields. It is a thin layer over tasks_store.json.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;
