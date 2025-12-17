import React, { useMemo, useState } from "react";
import type { DayTask } from "./TodayFocusBlock";
import {
  addProcessIntent,
  hasProcessIntent,
  realizeProcessIntent,
} from "../../v27/processIntentsStore";
import { t } from "../../i18n/t";

type GroupStats = {
  total: number;
  completed: number;
  active: number;
  urgent: number;
  noDeadline: number;
  queued: number;
};

function isCompleted(status?: string): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "done";
}

function isUrgent(task: any): boolean {
  const p = String(task?.priority ?? "").toLowerCase();
  if (p === "urgent" || p === "high") return true;
  const tt = String(task?.title ?? "").toLowerCase();
  if (tt.includes("urgent")) return true;
  return false;
}

function safeParseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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

function getTaskKey(x: any): string {
  const candidates = [x?.key, x?.task_key, x?.intent_key, x?.template_key, x?.process_key];
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return "";
}

function buildStats(items: any[], clientId?: string | null): GroupStats {
  let completed = 0;
  let urgent = 0;
  let noDeadline = 0;
  let queued = 0;

  for (const x of items) {
    const done = isCompleted(x?.status);
    if (done) completed += 1;
    if (isUrgent(x) && !done) urgent += 1;
    if (!safeParseDate(x?.deadline)) noDeadline += 1;

    const k = getTaskKey(x);
    if (clientId && k && hasProcessIntent(clientId, k)) queued += 1;
  }

  const total = items.length;
  const active = total - completed;
  return { total, completed, active, urgent, noDeadline, queued };
}

function pill(text: string): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-slate-200 bg-slate-50 text-slate-700">
      {text}
    </span>
  );
}

function urgentPill(text: string): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-amber-200 bg-amber-50 text-amber-800">
      {text}
    </span>
  );
}

function TaskRow(props: { task: any }) {
  const x = props.task;
  const title = String(x?.title ?? "").trim().length > 0 ? String(x.title) : t("focus.untitled");
  const d = safeParseDate(String(x?.deadline ?? ""));
  const deadlineText = d ? formatDateShort(d) : t("focus.unknown");
  const done = isCompleted(x?.status);

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-slate-100 last:border-b-0">
      <div className="flex flex-col min-w-0">
        <div className={"text-sm break-words " + (done ? "text-slate-400 line-through" : "text-slate-900 font-medium")}>
          {title}
        </div>
        <div className="text-xs text-slate-600 flex flex-wrap gap-3 mt-1">
          <span>{t("focus.status", { v: String(x?.status ?? "unknown") })}</span>
          <span>{t("focus.deadline", { v: deadlineText })}</span>
          {x?.priority ? <span>{t("focus.priority", { v: String(x.priority) })}</span> : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isUrgent(x) && !done ? urgentPill(t("focus.urgent")) : null}
        {done ? pill(t("signals.completed")) : pill("open")}
      </div>
    </div>
  );
}

async function realizeKeysSequential(clientId: string, keys: string[], onStep: (done: number, total: number) => void) {
  const total = keys.length;
  let done = 0;

  for (const k of keys) {
    try {
      await realizeProcessIntent(clientId, k);
    } catch {
      // ignore
    } finally {
      done += 1;
      onStep(done, total);
    }
  }
}

export default function GroupedTasksBlock(props: { tasks: DayTask[]; clientId?: string | null }) {
  const { tasks, clientId } = props;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkInfo, setBulkInfo] = useState<string>("");

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();

    for (const x of Array.isArray(tasks) ? (tasks as any[]) : []) {
      const key = String((x as any)?.group_key ?? "").trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(x as any);
    }

    const items = Array.from(map.entries()).map(([key, items]) => {
      const stats = buildStats(items, clientId ?? null);
      return { key, items, stats };
    });

    items.sort((a, b) => {
      if (b.stats.urgent !== a.stats.urgent) return b.stats.urgent - a.stats.urgent;
      if (b.stats.active !== a.stats.active) return b.stats.active - a.stats.active;
      return a.key.localeCompare(b.key);
    });

    return items;
  }, [tasks, clientId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900">
            {t("grouped.title")}
          </h2>
          <div className="text-xs text-slate-500">
            {t("grouped.groups", { n: groups.length })}
          </div>
          {bulkInfo ? <div className="text-xs text-slate-500">{bulkInfo}</div> : null}
        </div>

        <a className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm" href="/tasks">
          {t("grouped.openTasks")}
        </a>
      </div>

      {groups.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {t("grouped.empty")}
        </div>
      )}

      {groups.map((g) => {
        const isOpen = !!openGroups[g.key];
        const canBulk = !!clientId && busyKey === null;

        const pills: JSX.Element[] = [];
        if (g.stats.urgent > 0) pills.push(urgentPill(t("grouped.urgent", { n: g.stats.urgent })));
        pills.push(pill(t("grouped.active", { n: g.stats.active })));
        pills.push(pill(t("grouped.done", { n: g.stats.completed })));
        if (g.stats.noDeadline > 0) pills.push(pill(t("grouped.noDeadline", { n: g.stats.noDeadline })));
        if (clientId) pills.push(pill(t("grouped.queued", { n: g.stats.queued })));

        return (
          <div key={g.key} className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 flex items-start justify-between gap-4 bg-white">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="text-sm font-semibold text-slate-900 break-words">{g.key}</div>
                <div className="flex flex-wrap gap-2">
                  {pills.map((p, idx) => <React.Fragment key={idx}>{p}</React.Fragment>)}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <a
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm"
                  href={"/tasks?group=" + encodeURIComponent(g.key)}
                >
                  {t("grouped.viewInTasks")}
                </a>

                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 shadow-sm"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [g.key]: !isOpen }))}
                >
                  {isOpen ? t("grouped.collapse") : t("grouped.expand")}
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-4 bg-white">
                <div className="rounded-xl border border-slate-200 bg-white px-3">
                  {g.items.map((x: any) => (
                    <TaskRow key={String(x?.id ?? "") + String(getTaskKey(x) ?? "")} task={x} />
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={"rounded-xl border px-3 py-2 text-xs font-medium shadow-sm " + (canBulk && clientId ? "border-slate-200 bg-white hover:bg-slate-50" : "border-slate-200 bg-white text-slate-400")}
                    disabled={!clientId || !canBulk}
                    title={!clientId ? "Client id is required." : ""}
                    onClick={() => {
                      if (!clientId) return;

                      const keys = g.items
                        .filter((x: any) => !isCompleted(x?.status))
                        .map((x: any) => getTaskKey(x))
                        .filter((k: string) => !!k);

                      if (keys.length === 0) {
                        setBulkInfo(t("grouped.noOpenKeys"));
                        return;
                      }

                      setBusyKey(g.key);
                      setBulkInfo("Queueing: 0/" + String(keys.length));

                      let done = 0;
                      for (const k of keys) {
                        try { addProcessIntent(clientId, k); } catch { /* ignore */ }
                        done += 1;
                        setBulkInfo("Queueing: " + String(done) + "/" + String(keys.length));
                      }

                      setBusyKey(null);
                      setBulkInfo("Queued: " + String(done));
                    }}
                  >
                    {t("grouped.queueGroup")}
                  </button>

                  <button
                    type="button"
                    className={"rounded-xl border px-3 py-2 text-xs font-medium shadow-sm " + (canBulk && clientId ? "border-slate-200 bg-white hover:bg-slate-50" : "border-slate-200 bg-white text-slate-400")}
                    disabled={!clientId || !canBulk}
                    title={!clientId ? "Client id is required." : ""}
                    onClick={async () => {
                      if (!clientId) return;

                      const keys = g.items
                        .filter((x: any) => !isCompleted(x?.status))
                        .map((x: any) => getTaskKey(x))
                        .filter((k: string) => !!k)
                        .filter((k: string) => hasProcessIntent(clientId, k));

                      if (keys.length === 0) {
                        setBulkInfo(t("grouped.noQueued"));
                        return;
                      }

                      setBusyKey(g.key);
                      setBulkInfo("Realizing: 0/" + String(keys.length));

                      await realizeKeysSequential(clientId, keys, (done, total) => {
                        setBulkInfo("Realizing: " + String(done) + "/" + String(total));
                      });

                      setBusyKey(null);
                      setBulkInfo("Realize done: " + String(keys.length));
                    }}
                  >
                    {t("grouped.realizeQueued")}
                  </button>

                  {!clientId ? (
                    <div className="text-xs text-slate-500">
                      {t("grouped.bulkDisabled")}
                    </div>
                  ) : null}

                  {busyKey === g.key ? (
                    <div className="text-xs text-slate-500">
                      {t("grouped.working")}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}