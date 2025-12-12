import React, { useEffect, useMemo, useState } from "react";

/*
  v26.7.2
  Control events fetch is intentionally DISABLED.
  Reason: no stable public endpoint, avoid console noise and fake errors.
*/

type ClientProfile = {
  id?: string;
  code?: string;
  label?: string;
  short_label?: string;
  profile_type?: string;
};

type ProcessInstance = {
  client_id?: string;
  client_code?: string;
  client_label?: string;
  status?: string;
  computed_status?: string;
};

type Task = {
  client_id?: string;
  client_code?: string;
  client_label?: string;
  status?: string;
  computed_status?: string;
};

type ClientRow = {
  clientCode: string;
  label: string;
  profileType: string;
  period: string;

  processesTotal: number;
  processesClosed: number;
  processesOpen: number;
  processesStuck: number;

  tasksTotal: number;
  tasksNew: number;
  tasksInProgress: number;
  tasksDone: number;
};

type HealthLevel = "ok" | "attention" | "error";

function safeStr(v: any): string {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeStatus(raw?: string | null): string {
  const s = (raw || "").toLowerCase();
  if (["completed", "closed", "done"].includes(s)) return "done";
  if (["in_progress", "in-progress"].includes(s)) return "in_progress";
  if (["error", "failed", "stuck"].includes(s)) return "error";
  return "new";
}

function extractList(j: any): any[] {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  if (Array.isArray(j.items)) return j.items;
  if (Array.isArray(j.instances)) return j.instances;
  if (Array.isArray(j.tasks)) return j.tasks;
  return [];
}

function computeHealth(row: ClientRow): HealthLevel {
  if (row.processesStuck > 0) return "error";
  if (row.processesOpen > 0 || row.tasksNew > 0 || row.tasksInProgress > 0)
    return "attention";
  return "ok";
}

function healthBadge(h: HealthLevel) {
  if (h === "ok") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (h === "error") return "bg-red-50 text-red-800 ring-red-200";
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

type Props = {
  onOpenClient?: (clientCode: string) => void;
};

const ReglementOverviewPage: React.FC<Props> = ({ onOpenClient }) => {
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const period = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const [pRes, tRes, cRes] = await Promise.all([
          fetch("/api/internal/process-instances-v2/"),
          fetch("/api/tasks"),
          fetch("/api/internal/client-profiles"),
        ]);

        if (!alive) return;

        setProcesses(pRes.ok ? extractList(await pRes.json()) : []);
        setTasks(tRes.ok ? extractList(await tRes.json()) : []);
        setProfiles(cRes.ok ? extractList(await cRes.json()) : []);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const profilesByCode = useMemo(() => {
    const m = new Map<string, ClientProfile>();
    profiles.forEach((p) => {
      const c = safeStr(p.code || p.id);
      if (c) m.set(c, p);
    });
    return m;
  }, [profiles]);

  const rows: ClientRow[] = useMemo(() => {
    const map = new Map<string, ClientRow>();

    function ensure(code: string): ClientRow {
      if (map.has(code)) return map.get(code)!;
      const p = profilesByCode.get(code);
      const row: ClientRow = {
        clientCode: code,
        label: safeStr(p?.short_label || p?.label || code),
        profileType: safeStr(p?.profile_type || "-"),
        period,
        processesTotal: 0,
        processesClosed: 0,
        processesOpen: 0,
        processesStuck: 0,
        tasksTotal: 0,
        tasksNew: 0,
        tasksInProgress: 0,
        tasksDone: 0,
      };
      map.set(code, row);
      return row;
    }

    processes.forEach((p) => {
      const code = safeStr(p.client_code || p.client_id || p.client_label);
      if (!code) return;
      const r = ensure(code);
      r.processesTotal++;
      const st = normalizeStatus(p.computed_status || p.status);
      if (st === "done") r.processesClosed++;
      else if (st === "error") r.processesStuck++;
      else r.processesOpen++;
    });

    tasks.forEach((t) => {
      const code = safeStr(t.client_code || t.client_id || t.client_label);
      if (!code) return;
      const r = ensure(code);
      r.tasksTotal++;
      const st = normalizeStatus(t.computed_status || t.status);
      if (st === "done") r.tasksDone++;
      else if (st === "in_progress") r.tasksInProgress++;
      else r.tasksNew++;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.clientCode.localeCompare(b.clientCode)
    );
  }, [processes, tasks, profilesByCode, period]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reglement overview</h1>

      <div className="rounded-xl border bg-white p-4 text-sm">
        {loading ? "Loading..." : `Clients for period ${period}`}
      </div>

      <div className="rounded-xl border bg-white overflow-auto">
        <table className="min-w-[800px] w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2">Processes</th>
              <th className="px-3 py-2">Tasks</th>
              <th className="px-3 py-2">Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const h = computeHealth(r);
              return (
                <tr
                  key={r.clientCode}
                  className="hover:bg-sky-50 cursor-pointer"
                  onClick={() => onOpenClient && onOpenClient(r.clientCode)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-slate-500">
                      {r.clientCode} · {r.period}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    open: {r.processesOpen} / stuck: {r.processesStuck}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    new: {r.tasksNew} / in progress: {r.tasksInProgress}
                  </td>
                  <td className="px-3 py-2">
                    <span className={"inline-flex rounded-full px-2 py-0.5 text-xs ring-1 " + healthBadge(h)}>
                      {h}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReglementOverviewPage;