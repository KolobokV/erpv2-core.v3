import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/ui/SectionCard";
import StatusPill from "../components/ui/StatusPill";
import HorizonList, { HorizonItem } from "../components/ui/HorizonList";

type Task = {
  id?: string;
  title?: string;
  description?: string;
  status?: string;
  assignee?: string | null;
  due_date?: string | null;
  deadline?: string | null;
  client_id?: string | null;
  client_code?: string | null;
  [key: string]: any;
};

type ControlEvent = {
  id?: string;
  event_id?: string;
  client_code?: string;
  label?: string;
  title?: string;
  event_type?: string;
  status?: string;
  due_date?: string;
  deadline?: string;
  date?: string;
  [key: string]: any;
};

type TasksResponse = Task[] | { items?: Task[]; tasks?: Task[] };

type ControlEventsResponse =
  | ControlEvent[]
  | { events?: ControlEvent[]; items?: ControlEvent[] };

function extractTasks(data: TasksResponse | null | undefined): Task[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.tasks)) return data.tasks;
  return [];
}

function extractControlEvents(
  data: ControlEventsResponse | null | undefined
): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).events)) return (data as any).events;
  if (Array.isArray((data as any).items)) return (data as any).items;
  return [];
}

function parseIsoDateLike(value: string | undefined | null): Date | null {
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

function getControlEventDueRaw(ev: ControlEvent): string | undefined {
  return ev.due_date || ev.deadline || ev.date || undefined;
}

const DayDashboardPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [tasksResp, eventsResp] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/internal/control-events"),
        ]);

        if (!tasksResp.ok) {
          throw new Error("Failed to load tasks: " + tasksResp.status);
        }
        if (!eventsResp.ok) {
          throw new Error("Failed to load control events: " + eventsResp.status);
        }

        const tasksJson = (await tasksResp.json()) as TasksResponse;
        const eventsJson = (await eventsResp.json()) as ControlEventsResponse;

        if (!active) return;

        setTasks(extractTasks(tasksJson));
        setEvents(extractControlEvents(eventsJson));
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || "Failed to load day dashboard data");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAll();

    return () => {
      active = false;
    };
  }, []);

  const aggregates = useMemo(() => {
    const todayStr = getDateOnlyString(today);

    let totalTasks = 0;
    let overdueTasks = 0;
    let todayTasks = 0;

    const horizonTasks: HorizonItem[] = [];

    for (const t of tasks) {
      totalTasks += 1;
      const dueRaw = t.due_date ?? t.deadline ?? null;
      if (!dueRaw) continue;
      const d = parseIsoDateLike(dueRaw);
      if (!d) continue;
      const diff = getDateDiffInDays(d, today);
      const dateStr = getDateOnlyString(d);

      if (dateStr < todayStr) {
        overdueTasks += 1;
      } else if (dateStr === todayStr) {
        todayTasks += 1;
      }

      if (diff < 0 || diff <= 7) {
        horizonTasks.push({
          id: String(t.id ?? t.client_id ?? t.title ?? "task"),
          title: t.title || "Task",
          date: dateStr,
          category: t.client_id || t.client_code || undefined,
          highlight: diff < 0 ? "overdue" : diff === 0 ? "today" : "soon",
        });
      }
    }

    let totalEvents = 0;
    let overdueEvents = 0;
    let todayEvents = 0;

    const horizonEvents: HorizonItem[] = [];

    for (const ev of events) {
      const dueRaw = getControlEventDueRaw(ev);
      if (!dueRaw) continue;
      const d = parseIsoDateLike(dueRaw);
      if (!d) continue;
      totalEvents += 1;

      const dateStr = getDateOnlyString(d);
      const diff = getDateDiffInDays(d, today);

      if (dateStr < todayStr) {
        overdueEvents += 1;
      } else if (dateStr === todayStr) {
        todayEvents += 1;
      }

      if (diff < 0 || diff <= 7) {
        horizonEvents.push({
          id: String(ev.id ?? ev.event_id ?? ev.code ?? "event"),
          title: ev.label || ev.title || ev.code || "Event",
          date: dateStr,
          category: ev.client_code || ev.event_type || undefined,
          highlight: diff < 0 ? "overdue" : diff === 0 ? "today" : "soon",
        });
      }
    }

    horizonTasks.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    horizonEvents.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    return {
      totalTasks,
      overdueTasks,
      todayTasks,
      totalEvents,
      overdueEvents,
      todayEvents,
      horizonTasks,
      horizonEvents,
    };
  }, [tasks, events, today]);

  const combinedHorizon: HorizonItem[] = useMemo(() => {
    const taggedTasks = aggregates.horizonTasks.map((item) => ({
      ...item,
      title: "[T] " + item.title,
    }));
    const taggedEvents = aggregates.horizonEvents.map((item) => ({
      ...item,
      title: "[E] " + item.title,
    }));
    const all = [...taggedTasks, ...taggedEvents];
    all.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return all.slice(0, 40);
  }, [aggregates]);

  const todayLabel = useMemo(() => {
    const weekday = today.toLocaleDateString(undefined, { weekday: "long" });
    const dateStr = today.toISOString().slice(0, 10);
    return weekday + " · " + dateStr;
  }, [today]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Day dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Global view of tasks and control events for all clients for today and the nearest days.
          </p>
        </div>
        <div className="text-xs text-slate-600">
          {todayLabel}
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading day dashboard data...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-3 text-xs md:grid-cols-4">
            <SectionCard title="Tasks today" variant="default">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-slate-500">Total</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {aggregates.totalTasks}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Today</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {aggregates.todayTasks}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Overdue</div>
                  <div className="text-lg font-semibold text-red-700">
                    {aggregates.overdueTasks}
                  </div>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Control events" variant="default">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-slate-500">Total</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {aggregates.totalEvents}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Today</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {aggregates.todayEvents}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Overdue</div>
                  <div className="text-lg font-semibold text-red-700">
                    {aggregates.overdueEvents}
                  </div>
                </div>
              </div>
            </SectionCard>
            <SectionCard
              title="Risk snapshot"
              actions={
                aggregates.overdueTasks + aggregates.overdueEvents > 0 ? (
                  <StatusPill label="Attention required" tone="danger" />
                ) : aggregates.todayTasks + aggregates.todayEvents > 0 ? (
                  <StatusPill label="Workload today" tone="warning" />
                ) : (
                  <StatusPill label="Calm day" tone="success" />
                )
              }
            >
              <p className="text-[11px] text-slate-600">
                Overdue items: {aggregates.overdueTasks + aggregates.overdueEvents}.{" "}
                Today items: {aggregates.todayTasks + aggregates.todayEvents}.
              </p>
            </SectionCard>
            <SectionCard title="Summary" variant="muted">
              <p className="text-[11px] text-slate-600">
                This dashboard is an overview only. Detailed per-client view is available in the
                client cockpit.
              </p>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard
              title="Nearest tasks"
              subtitle="Tasks with deadlines today and in the next 7 days."
            >
              <HorizonList
                items={aggregates.horizonTasks.slice(0, 40)}
                emptyLabel="No tasks in the nearest horizon."
              />
            </SectionCard>
            <SectionCard
              title="Nearest control events"
              subtitle="Control events for all clients for today and the next 7 days."
            >
              <HorizonList
                items={aggregates.horizonEvents.slice(0, 40)}
                emptyLabel="No control events in the nearest horizon."
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Combined horizon"
            subtitle="Tasks and control events together, sorted by date."
          >
            <HorizonList
              items={combinedHorizon}
              emptyLabel="Nothing on the combined horizon."
            />
          </SectionCard>
        </>
      )}
    </div>
  );
};

export default DayDashboardPage;
