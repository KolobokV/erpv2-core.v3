import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
  payload?: any;
  meta?: any;
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
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

const statusOptions: string[] = [
  "new",
  "planned",
  "pending",
  "waiting_for_docs",
  "in_progress",
  "done",
  "overdue",
  "cancelled"
];

const ClientControlEventPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const eventId = searchParams.get("event_id") || "";
  const clientCodeFromQuery = searchParams.get("client_code") || "";
  const periodFromQuery = searchParams.get("period") || "";

  const [event, setEvent] = useState<ControlEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [editableStatus, setEditableStatus] = useState<string>("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    const loadEvent = async () => {
      setLoadingEvent(true);
      setEventError(null);
      setSaveMessage(null);
      setSaveError(null);
      try {
        const resp = await fetch(
          `/api/internal/control-events/${encodeURIComponent(eventId)}`
        );
        if (!resp.ok) {
          throw new Error("Failed to load control event: " + resp.status);
        }
        const json: ControlEvent = await resp.json();
        if (isMounted) {
          setEvent(json);
          setEditableStatus(json.status || "");
        }
      } catch (e: any) {
        if (isMounted) {
          setEventError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoadingEvent(false);
        }
      }
    };
    loadEvent();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;
    const loadTasks = async () => {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const resp = await fetch("/api/tasks");
        if (!resp.ok) {
          throw new Error("Failed to load tasks: " + resp.status);
        }
        const json: TasksResponse = await resp.json();
        const list = extractTasks(json).filter(
          (t) => (t.event_id || "").toString() === eventId.toString()
        );
        if (isMounted) {
          setTasks(list);
        }
      } catch (e: any) {
        if (isMounted) {
          setTasksError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setTasksLoading(false);
        }
      }
    };
    loadTasks();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const handleSaveStatus = async () => {
    if (!eventId) return;
    if (!editableStatus) return;
    setSavingStatus(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const url = `/api/internal/control-events/${encodeURIComponent(
        eventId
      )}/status`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: editableStatus })
      });
      if (!resp.ok) {
        throw new Error("Failed to update event status: " + resp.status);
      }
      setSaveMessage("Status updated.");
      setEvent((prev) =>
        prev ? { ...prev, status: editableStatus } : prev
      );
    } catch (e: any) {
      setSaveError(e?.message || "Unknown error");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleMarkDone = async () => {
    if (!eventId) return;
    setEditableStatus("done");
    await handleSaveStatus();
  };

  const handleBack = () => {
    if (clientCodeFromQuery || periodFromQuery) {
      const params = new URLSearchParams();
      if (clientCodeFromQuery) {
        params.set("client_code", clientCodeFromQuery);
      }
      if (periodFromQuery) {
        const parts = periodFromQuery.split("-");
        if (parts.length === 2) {
          params.set("year", parts[0]);
          params.set("month", parts[1]);
        }
      }
      navigate(`/reglement-overview?${params.toString()}`);
    } else {
      navigate(-1);
    }
  };

  const effectiveClientCode =
    event?.client_code || clientCodeFromQuery || "-";
  const effectivePeriod = event?.period || periodFromQuery || "-";

  const statusOptionsWithCurrent = useMemo(() => {
    const current = (event?.status || "").toLowerCase();
    const base = [...statusOptions];
    if (current && !base.includes(current)) {
      base.unshift(current);
    }
    return base;
  }, [event?.status]);

  const pageTitle = event
    ? `${event.label || event.code || event.id || "Control event"}`
    : eventId
    ? `Control event ${eventId}`
    : "Control event";

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-600">
            Detail view of a single control event with status and related tasks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to reglement
          </button>
        </div>
      </div>

      {!eventId && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Missing event_id in query string.
        </div>
      )}

      {eventError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Failed to load control event: {eventError}
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

      {(loadingEvent || tasksLoading) && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading event details...
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Event details
            </h2>
            <span className="text-xs text-slate-500">
              ID: {event?.id || eventId || "-"}
            </span>
          </div>
          {event ? (
            <div className="space-y-2 text-xs text-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Code</div>
                <div>{event.code || event.type || "-"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Label</div>
                <div>{event.label || "-"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Category</div>
                <div>{event.category || "-"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Client code</div>
                <div>{effectiveClientCode}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Period</div>
                <div>{effectivePeriod}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Planned date</div>
                <div>{formatDate(event.planned_date)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-slate-500">Due date</div>
                <div>{formatDate(event.due_date)}</div>
              </div>
              {event.created_at && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-slate-500">Created</div>
                  <div>{formatDateTime(event.created_at)}</div>
                </div>
              )}
              {event.updated_at && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-slate-500">Updated</div>
                  <div>{formatDateTime(event.updated_at)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              {loadingEvent ? "Loading event..." : "No event loaded."}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Status and actions
            </h2>
          </div>
          <div className="space-y-3 text-xs text-slate-800">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-600">
                Status
              </label>
              <select
                className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                value={editableStatus}
                onChange={(e) => setEditableStatus(e.target.value)}
                disabled={!eventId || savingStatus}
              >
                <option value="">Select status</option>
                {statusOptionsWithCurrent.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={!editableStatus || savingStatus || !eventId}
                className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingStatus ? "Saving..." : "Save status"}
              </button>
              <button
                type="button"
                onClick={handleMarkDone}
                disabled={savingStatus || !eventId}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark done
              </button>
            </div>

            {event && (
              <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2 text-[11px] text-slate-600">
                This section only updates the status field of the control event
                via /api/internal/control-events/{`{event_id}`}/status.
                Dates and other fields are read-only in this version.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Related tasks
          </h2>
          <span className="text-xs text-slate-500">{tasks.length}</span>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Tasks linked to this control event via task.event_id.
        </p>
        {tasksError && (
          <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            Failed to load tasks: {tasksError}
          </div>
        )}
        {tasks.length === 0 && !tasksLoading && (
          <div className="text-xs text-slate-500">
            No tasks linked to this event.
          </div>
        )}
        {tasks.length > 0 && (
          <div className="max-h-80 space-y-1 overflow-auto text-xs">
            <div className="grid grid-cols-4 gap-2 border-b border-slate-100 pb-1 font-medium text-slate-600">
              <div>Task</div>
              <div>Status</div>
              <div className="text-right">Deadline</div>
              <div className="text-right">Priority</div>
            </div>
            {tasks.map((t) => {
              const title = t.title || "-";
              const status = t.status || "-";
              const deadline = formatDate(t.deadline);
              const priority = t.priority || "";
              return (
                <div
                  key={t.id || `${title}-${t.deadline || ""}-${Math.random()}`}
                  className="grid grid-cols-4 gap-2 border-b border-slate-100 py-1 last:border-b-0"
                >
                  <div className="truncate" title={title}>
                    {title}
                  </div>
                  <div>{status}</div>
                  <div className="text-right text-slate-700">
                    {deadline}
                  </div>
                  <div className="text-right text-slate-700">
                    {priority || "-"}
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

export default ClientControlEventPage;
