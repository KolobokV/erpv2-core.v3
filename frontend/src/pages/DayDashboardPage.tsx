import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import TodayFocusBlock, { DayTask } from "../components/day/TodayFocusBlock";
import GroupedTasksBlock from "../components/day/GroupedTasksBlock";
import ProcessSignalsBlock from "../components/day/ProcessSignalsBlock";
import UpcomingBlock from "../components/day/UpcomingBlock";
import { getClientFromLocation } from "../v27/clientContext";
import { t } from "../i18n/t";

type Task = DayTask;

export default function DayDashboardPage() {
  const location = useLocation();
  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/tasks");
        if (!res.ok) throw new Error("tasks_fetch_failed");
        const data = await res.json();
        if (Array.isArray(data)) setTasks(data);
        else if (Array.isArray(data?.tasks)) setTasks(data.tasks);
        else setTasks([]);
      } catch {
        setError(t("common.failed"));
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
                {t("day.title")}
              </h1>
              <div className="mt-1 text-sm text-slate-600">
                {t("day.subtitle")}
              </div>

              {clientId ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{t("day.client", { id: clientId })}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/tasks"
                className="w-full sm:w-auto text-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm"
              >
                {t("common.openTasks")}
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-6">
            <TodayFocusBlock tasks={tasks} />
            <GroupedTasksBlock tasks={tasks as any[]} clientId={clientId} />
          </div>

          <div className="lg:col-span-5 space-y-6">
            <UpcomingBlock tasks={tasks} />
            <ProcessSignalsBlock />
          </div>
        </div>
      </div>
    </div>
  );
}