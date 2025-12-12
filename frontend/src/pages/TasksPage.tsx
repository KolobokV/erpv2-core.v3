import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";
import TaskCard from "../components/ui/TaskCard";
import { loadMaterializedTasksV27 } from "../v27/profileStore";

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

function localTaskToUi(t: any, clientId: string): any {
  const due = safeStr(t?.due_date);
  const deadlineIso = due ? due + "T00:00:00.000Z" : new Date().toISOString();
  return {
    id: safeStr(t?.id),
    title: safeStr(t?.title || "Untitled"),
    status: safeStr(t?.status || "open"),
    deadline: deadlineIso,
    client_code: clientId,
    source: "v27_local",
    v27_readonly: true,
  };
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
    setTasks(Array.isArray(arr) ? arr : []);
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergedTasks = useMemo(() => {
    const c = safeStr(client);
    if (!c) return tasks || [];

    const backend = (tasks || []).filter((t: any) => getClientKey(t) === c);

    const localRes = loadMaterializedTasksV27(c);
    const localItems = localRes?.items || [];
    const localUi = localItems.map((t: any) => localTaskToUi(t, c));

    const seen = new Set<string>();
    const merged: any[] = [];

    for (const t of backend) {
      const id = safeStr(t?.id);
      if (id && !seen.has(id)) {
        seen.add(id);
        merged.push(t);
      }
    }
    for (const t of localUi) {
      const id = safeStr(t?.id);
      if (id && !seen.has(id)) {
        seen.add(id);
        merged.push(t);
      }
    }

    merged.sort((a: any, b: any) => safeStr(a?.deadline).localeCompare(safeStr(b?.deadline)));
    return merged;
  }, [tasks, client]);

  const filtered = useMemo(() => {
    const c = safeStr(client);
    if (!c) return tasks || [];
    return mergedTasks;
  }, [tasks, mergedTasks, client]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const overdue = useMemo(() => {
    return (filtered || []).filter((t: any) => safeStr(t?.deadline).slice(0, 10) < todayIso);
  }, [filtered, todayIso]);

  const dueSoon = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const d7 = d.toISOString().slice(0, 10);
    return (filtered || []).filter((t: any) => {
      const dl = safeStr(t?.deadline).slice(0, 10);
      return dl >= todayIso && dl <= d7;
    });
  }, [filtered, todayIso]);

  const completed = useMemo(() => {
    return (filtered || []).filter((t: any) => safeStr(t?.status) === "completed");
  }, [filtered]);

  const renderList = (title: string, list: any[]) => (
    <SectionCard title={title}>
      {list.length === 0 ? (
        <div className="text-sm text-slate-500">No items</div>
      ) : (
        <div className="space-y-2">
          {list.map((t: any) => {
            const isLocal = safeStr(t?.source) === "v27_local" || t?.v27_readonly === true;
            return (
              <TaskCard
                key={safeStr(t?.id)}
                task={t}
                badge={isLocal ? "V27" : undefined}
                onStart={undefined}
                onComplete={undefined}
                onReopen={undefined}
                onDefer={undefined}
              />
            );
          })}
        </div>
      )}
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Tasks Board V3</h1>

        {client ? (
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => nav(clearClientFromUrl(loc.pathname, loc.search))}
          >
            Clear client filter
          </button>
        ) : null}
      </div>

      {client ? (
        <div className="text-sm text-slate-600">
          client filter: <span className="font-mono">{client}</span>
        </div>
      ) : (
        <div className="text-sm text-slate-500">Select client via ?client=</div>
      )}

      {renderList("Overdue", overdue)}
      {renderList("Due soon (7 days)", dueSoon)}
      {renderList("Completed", completed)}
    </div>
  );
};

export default TasksPage;