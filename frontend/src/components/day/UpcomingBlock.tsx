import React, { useMemo, useState } from "react";
import type { DayTask } from "./TodayFocusBlock";
import { t } from "../../i18n/t";

function safeParseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function isCompleted(status?: string): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "done";
}

function formatDateShort(d: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + dd;
  }
}

function TaskLine(props: { task: DayTask }) {
  const x = props.task;
  const title = x.title && x.title.trim().length > 0 ? x.title : t("upcoming.untitled");
  const d = safeParseDate(x.deadline);
  const dt = d ? formatDateShort(d) : "n/a";

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex flex-col min-w-0">
        <div className="text-sm font-semibold text-slate-900 break-words">
          {title}
        </div>
        <div className="text-xs text-slate-600 flex flex-wrap gap-3 mt-1">
          <span>{t("upcoming.deadline", { v: dt })}</span>
          {x.group_key ? <span>{t("upcoming.group", { v: x.group_key })}</span> : null}
          {x.priority ? <span>{t("upcoming.priority", { v: x.priority })}</span> : null}
        </div>
      </div>

      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-slate-200 bg-slate-50 text-slate-700">
        {t("upcoming.openPill")}
      </span>
    </div>
  );
}

type Bucket = {
  label: string;
  days: number;
  tasks: DayTask[];
};

export default function UpcomingBlock(props: { tasks: DayTask[] }) {
  const { tasks } = props;
  const [mode, setMode] = useState<"3" | "7" | "14">("7");

  const buckets = useMemo((): Bucket[] => {
    const now = new Date();
    const from = startOfLocalDay(now);
    const d3 = addDays(from, 3);
    const d7 = addDays(from, 7);
    const d14 = addDays(from, 14);

    const openTasks = (Array.isArray(tasks) ? tasks : []).filter((x) => !isCompleted(x.status));

    const within = (to: Date) => {
      const list: DayTask[] = [];
      for (const x of openTasks) {
        const dd = safeParseDate(x.deadline);
        if (!dd) continue;
        if (dd >= from && dd < to) list.push(x);
      }
      list.sort((a, b) => {
        const da = safeParseDate(a.deadline)?.getTime() ?? 0;
        const db = safeParseDate(b.deadline)?.getTime() ?? 0;
        return da - db;
      });
      return list;
    };

    return [
      { label: t("upcoming.next3"), days: 3, tasks: within(d3) },
      { label: t("upcoming.next7"), days: 7, tasks: within(d7) },
      { label: t("upcoming.next14"), days: 14, tasks: within(d14) },
    ];
  }, [tasks]);

  const current = buckets.find((b) => String(b.days) === mode) || buckets[1];
  const total = current.tasks.length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("upcoming.title")}
          </h2>
          <div className="text-xs text-slate-500">
            {t("upcoming.horizonCount", { label: current.label, n: total })}
          </div>
        </div>

        <a
          href="/tasks?due=next7"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm"
        >
          {t("upcoming.openNext7")}
        </a>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className={"rounded-xl border px-3 py-2 text-xs font-medium shadow-sm " + (mode === "3" ? "border-slate-900 text-slate-900 bg-white" : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50")}
          onClick={() => setMode("3")}
        >
          +3
        </button>
        <button
          type="button"
          className={"rounded-xl border px-3 py-2 text-xs font-medium shadow-sm " + (mode === "7" ? "border-slate-900 text-slate-900 bg-white" : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50")}
          onClick={() => setMode("7")}
        >
          +7
        </button>
        <button
          type="button"
          className={"rounded-xl border px-3 py-2 text-xs font-medium shadow-sm " + (mode === "14" ? "border-slate-900 text-slate-900 bg-white" : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50")}
          onClick={() => setMode("14")}
        >
          +14
        </button>
      </div>

      {total === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {t("upcoming.empty")}
        </div>
      )}

      {total > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-3">
          {current.tasks.slice(0, 12).map((x) => (
            <TaskLine key={x.id} task={x} />
          ))}
          {current.tasks.length > 12 && (
            <div className="py-2 text-xs text-slate-500">
              Hidden: {current.tasks.length - 12}
            </div>
          )}
        </div>
      )}
    </section>
  );
}