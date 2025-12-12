import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";
import TaskCard from "../components/ui/TaskCard";
import { getClientFromLocation } from "../v27/clientContext";
import { buildV27Bundle } from "../v27/bridge";
import { V27DerivedPanel } from "../components/V27DerivedPanel";
import { loadMaterializedTasksV27 } from "../v27/profileStore";

function safeStr(v: any): string {
  return v === null || v === undefined ? "" : String(v);
}

function getClientKey(t: any): string {
  return safeStr(t?.client_code || t?.client_id || t?.client_label);
}

function isoDayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

export default function DayDashboardPage() {
  const loc = useLocation();
  const clientId = getClientFromLocation(loc);

  const bundle = useMemo(() => {
    if (!clientId) return null;
    return buildV27Bundle(clientId);
  }, [clientId]);

  const [tasks, setTasks] = useState<any[]>([]);

  const loadTasks = async () => {
    const resp = await fetch("/api/tasks");
    const json = await resp.json();
    const arr = Array.isArray(json) ? json : json.tasks || [];
    setTasks(Array.isArray(arr) ? arr : []);
  };

  useEffect(() => {
    loadTasks().catch(() => setTasks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergedForClient = useMemo(() => {
    const client = safeStr(clientId);
    if (!client) return [];

    const backend = (tasks || []).filter((t: any) => getClientKey(t) === client);

    const localRes = loadMaterializedTasksV27(client);
    const localItems = localRes?.items || [];
    const localUi = localItems.map((t: any) => localTaskToUi(t, client));

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
  }, [tasks, clientId]);

  const today = new Date().toISOString().slice(0, 10);
  const d7 = isoDayPlus(7);

  const nearest = useMemo(() => {
    return mergedForClient
      .filter((t: any) => {
        const dl = safeStr(t?.deadline).slice(0, 10);
        return dl >= today && dl <= d7;
      })
      .slice(0, 12);
  }, [mergedForClient, today, d7]);

  return (
    <div className="space-y-4">
      {bundle ? (
        <V27DerivedPanel title="V27: profile-derived obligations" clientId={clientId || ""} derived={bundle.derived} risks={bundle.risks} />
      ) : (
        <div className="text-sm text-slate-500">Select client to view v27 bundle.</div>
      )}

      <SectionCard title="Nearest tasks" subtitle="Tasks due today and in the next 7 days.">
        {nearest.length === 0 ? (
          <div className="text-sm text-slate-500">No tasks in next 7 days.</div>
        ) : (
          <div className="space-y-2">
            {nearest.map((t: any) => {
              const isLocal = safeStr(t?.source) === "v27_local" || t?.v27_readonly === true;
              return (
                <TaskCard
                  key={safeStr(t?.id)}
                  task={t}
                  badge={isLocal ? "V27" : undefined}
                  onStart={isLocal ? undefined : undefined}
                  onComplete={isLocal ? undefined : undefined}
                  onReopen={isLocal ? undefined : undefined}
                  onDefer={isLocal ? undefined : undefined}
                />
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}