import React, { useMemo, useState } from "react";
import { t } from "../../i18n/t";

export type DayTask = {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  group_key?: string | null;
};

function safeParseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function isCompleted(status?: string): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "done";
}

function isUrgent(task: DayTask): boolean {
  const p = (task.priority || "").toLowerCase();
  if (p === "urgent" || p === "high") return true;
  const tt = (task.title || "").toLowerCase();
  if (tt.includes("urgent")) return true;
  return false;
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

type BadgeKind = "overdue" | "today" | "urgent" | "other";

function badgeLabel(kind: BadgeKind): string {
  if (kind === "urgent") return t("focus.urgent");
  if (kind === "overdue") return t("focus.overdue");
  if (kind === "today") return t("focus.dueToday");
  return t("focus.other");
}

function pillClass(kind: BadgeKind): string {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
  if (kind === "overdue") return base + " border-red-200 bg-red-50 text-red-700";
  if (kind === "urgent") return base + " border-amber-200 bg-amber-50 text-amber-800";
  if (kind === "today") return base + " border-emerald-200 bg-emerald-50 text-emerald-800";
  return base + " border-slate-200 bg-slate-50 text-slate-700";
}

function chip(text: string): JSX.Element {
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 break-words">
      {text}
    </span>
  );
}

function LinkButton(props: { href: string; label: string }) {
  return (
    <a
      href={props.href}
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm"
    >
      {props.label}
    </a>
  );
}

function leftBarClass(kind: BadgeKind): string {
  if (kind === "urgent") return "bg-amber-400";
  if (kind === "overdue") return "bg-red-500";
  if (kind === "today") return "bg-emerald-500";
  return "bg-slate-300";
}

function TaskCard(props: { task: DayTask; badge: BadgeKind }) {
  const { task, badge } = props;

  const title = task.title && task.title.trim().length > 0 ? task.title : t("focus.untitled");
  const status = task.status && task.status.trim().length > 0 ? task.status : "unknown";
  const priority = task.priority && task.priority.trim().length > 0 ? task.priority : "";

  const d = safeParseDate(task.deadline);
  const deadlineText = d ? formatDateShort(d) : t("focus.unknown");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex">
        <div className={"w-1.5 " + leftBarClass(badge)} />
        <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="text-sm font-semibold leading-5 break-words min-w-0 text-slate-900">
              {title}
            </div>
            <span className={pillClass(badge)}>
              {badgeLabel(badge)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {chip(t("focus.status", { v: status }))}
            {priority ? chip(t("focus.priority", { v: priority })) : null}
            {chip(t("focus.deadline", { v: deadlineText }))}
            {task.group_key ? chip(t("focus.group", { v: task.group_key })) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type Classified = {
  urgent: DayTask[];
  overdue: DayTask[];
  today: DayTask[];
  other: DayTask[];
};

function classify(tasks: DayTask[]): Classified {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  const urgent: DayTask[] = [];
  const overdue: DayTask[] = [];
  const today: DayTask[] = [];
  const other: DayTask[] = [];

  for (const task of tasks) {
    if (isCompleted(task.status)) continue;

    if (isUrgent(task)) {
      urgent.push(task);
      continue;
    }

    const d = safeParseDate(task.deadline);
    if (!d) {
      other.push(task);
      continue;
    }

    if (d < todayStart) {
      overdue.push(task);
      continue;
    }

    if (d >= todayStart && d <= todayEnd) {
      today.push(task);
      continue;
    }

    other.push(task);
  }

  return { urgent, overdue, today, other };
}

function SummaryPill(props: { kind: BadgeKind; label: string; value: number }) {
  const { kind, label, value } = props;
  const border =
    kind === "urgent" ? "border-amber-200 bg-amber-50 text-amber-900" :
    kind === "overdue" ? "border-red-200 bg-red-50 text-red-900" :
    kind === "today" ? "border-emerald-200 bg-emerald-50 text-emerald-900" :
    "border-slate-200 bg-slate-50 text-slate-900";

  const dot =
    kind === "urgent" ? "bg-amber-500" :
    kind === "overdue" ? "bg-red-500" :
    kind === "today" ? "bg-emerald-600" :
    "bg-slate-400";

  return (
    <div className={"flex items-center justify-between rounded-xl border px-3 py-2 text-xs " + border}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={"h-1.5 w-1.5 rounded-full " + dot} />
        <span className="truncate">{label}</span>
      </div>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function TodayFocusBlock(props: { tasks: DayTask[] }) {
  const { tasks } = props;
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  const { urgent, overdue, today, other, completedCount } = useMemo(() => {
    const base = Array.isArray(tasks) ? tasks : [];
    const completed = base.filter((x) => isCompleted(x.status));
    const active = base.filter((x) => !isCompleted(x.status));
    const view = showCompleted ? base : active;

    const classified = classify(view);
    return { ...classified, completedCount: completed.length };
  }, [tasks, showCompleted]);

  const totalVisible = urgent.length + overdue.length + today.length + other.length;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("focus.title")}
          </h2>
          <div className="text-xs text-slate-500">
            {t("focus.visible", { n: totalVisible })}
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm"
          onClick={() => setShowCompleted((v) => !v)}
        >
          {showCompleted ? t("common.hideCompleted") : t("common.showCompleted")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryPill kind="urgent" label={t("focus.urgent")} value={urgent.length} />
        <SummaryPill kind="overdue" label={t("focus.overdue")} value={overdue.length} />
        <SummaryPill kind="today" label={t("focus.dueToday")} value={today.length} />
        <SummaryPill kind="other" label={t("focus.other")} value={other.length} />
        <SummaryPill kind="other" label={t("focus.completedHidden")} value={completedCount} />
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/tasks?priority=urgent" label={t("focus.ctaUrgent", { n: urgent.length })} />
        <LinkButton href="/tasks?due=overdue" label={t("focus.ctaOverdue", { n: overdue.length })} />
        <LinkButton href="/tasks?due=today" label={t("focus.ctaToday", { n: today.length })} />
        <LinkButton href="/tasks?due=next7" label={t("focus.ctaNext7")} />
        <LinkButton href="/tasks?group=burning" label={t("focus.ctaBurning")} />
      </div>

      {totalVisible === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          {t("focus.noItems")}
        </div>
      )}

      {urgent.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">{t("focus.urgent")}</div>
          <div className="space-y-2">
            {urgent.map((x) => (
              <TaskCard key={x.id} task={x} badge="urgent" />
            ))}
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">{t("focus.overdue")}</div>
          <div className="space-y-2">
            {overdue.map((x) => (
              <TaskCard key={x.id} task={x} badge="overdue" />
            ))}
          </div>
        </div>
      )}

      {today.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">{t("focus.dueToday")}</div>
          <div className="space-y-2">
            {today.map((x) => (
              <TaskCard key={x.id} task={x} badge="today" />
            ))}
          </div>
        </div>
      )}

      {other.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">{t("focus.other")}</div>
          <div className="space-y-2">
            {other.slice(0, 12).map((x) => (
              <TaskCard key={x.id} task={x} badge="other" />
            ))}
          </div>
          {other.length > 12 && (
            <div className="text-xs text-slate-500">
              Hidden: {other.length - 12}
            </div>
          )}
        </div>
      )}
    </section>
  );
}