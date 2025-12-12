import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";
import TaskCard from "../components/ui/TaskCard";

function safeStr(v: any): string {
  return v === null || v === undefined ? "" : String(v);
}

function getClientKey(t: any): string {
  return safeStr(t?.client_code || t?.client_id || t?.client_label);
}

function getClientFromSearch(search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    return (sp.get("client") || "").trim();
  } catch {
    return "";
  }
}

function clearClientFromUrl(pathname: string, search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    if (!sp.has("client")) return pathname + (search || "");
    sp.delete("client");
    const next = sp.toString();
    return pathname + (next ? "?" + next : "");
  } catch {
    return pathname;
  }
}

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);

  const loc = useLocation();
  const nav = useNavigate();
  const client = useMemo(() => getClientFromSearch(loc.search), [loc.search]);

  const loadTasks = async () => {
    const resp = await fetch("/api/tasks");
    const json = await resp.json();
    const arr = Array.isArray(json) ? json : json.tasks || [];
    setTasks(arr);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const today = new Date();

  const addDays = (date: any, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const changeStatus = async (task: any, status: string) => {
    await fetch(`/api/tasks/${task.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
  };

  const deferTask = async (task: any, days: number) => {
    const base = task.deadline || new Date().toISOString();
    const newDL = addDays(base, days);

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: newDL }),
    });

    loadTasks();
  };

  const filteredTasks = useMemo(() => {
    if (!client) return tasks;
    return tasks.filter((t) => getClientKey(t) === client);
  }, [tasks, client]);

  const buckets = useMemo(() => {
    const map: any = { overdue: [], today: [], next7: [], future: [] };

    filteredTasks.forEach((t: any) => {
      if (!t.deadline) {
        map.future.push(t);
        return;
      }
      const d = new Date(t.deadline);
      const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
      if (diff < 0) map.overdue.push(t);
      else if (diff === 0) map.today.push(t);
      else if (diff <= 7) map.next7.push(t);
      else map.future.push(t);
    });

    return map;
  }, [filteredTasks]);

  const renderBucket = (title: string, list: any[]) => (
    <SectionCard title={title}>
      {list.length === 0 ? (
        <div className="text-xs text-slate-500">No tasks</div>
      ) : (
        <div className="space-y-2">
          {list.map((t: any) => (
            <TaskCard
              key={t.id}
              task={t}
              onStart={() => changeStatus(t, "in_progress")}
              onComplete={() => changeStatus(t, "completed")}
              onReopen={() => changeStatus(t, "new")}
              onDefer={(task: any, days: number) => deferTask(task, days)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Tasks Board V3</h1>

        {client && (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
            <span className="text-slate-500">client</span>
            <span className="font-medium">{client}</span>
            <button
              type="button"
              className="rounded-full px-1 text-[11px] text-slate-500 hover:bg-slate-100"
              title="Clear client context"
              onClick={() => nav(clearClientFromUrl(loc.pathname, loc.search))}
            >
              x
            </button>
          </div>
        )}
      </div>

      {renderBucket("Overdue", buckets.overdue)}
      {renderBucket("Today", buckets.today)}
      {renderBucket("Next 7 days", buckets.next7)}
      {renderBucket("Future", buckets.future)}
    </div>
  );
};

export default TasksPage;