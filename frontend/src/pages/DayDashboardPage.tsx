import React, { useEffect, useMemo, useState } from "react";
import { apiGetJson } from "../lib/api";

type ClientProfile = {
  id: string;
  name: string;
  tax_mode?: string;
  features?: string[];
  payroll_days?: number[];
  is_active?: boolean;
};

type TaskItem = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string | null;
  assignee?: string | null;
  client_id?: string;
};

type ProcessInstance = {
  id: string;
  client_id?: string;
  profile_id?: string;
  status?: string;
  source?: string;
  created_at?: string;
};

function normalizeClientId(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/^demo-client-(\d+)$/);
  if (m) return `demo_client_${m[1]}`;
  return s;
}

function deriveTaskClientId(t: TaskItem): string {
  const direct = (t.client_id ?? "").trim();
  if (direct) return normalizeClientId(direct);

  const id = (t.id ?? "").trim();
  if (!id) return "";

  // demo seed ids like: task-demo-client-1-bank-statement-2025-12-01
  const mDemo = id.match(/^task-demo-client-(\d+)-/);
  if (mDemo) return `demo_client_${mDemo[1]}`;

  // common pattern: task-<clientId>-...
  const m = id.match(/^task-([A-Za-z0-9_]+)-/);
  if (m) return normalizeClientId(m[1]);

  return "";
}

function deriveProcessClientId(p: ProcessInstance): string {
  const direct = (p.client_id ?? p.profile_id ?? "").trim();
  if (direct) return normalizeClientId(direct);

  const id = (p.id ?? "").trim();
  if (!id) return "";

  // try: <clientId>__something or <clientId>-something
  const mUnd = id.match(/^([A-Za-z0-9_]+)__/);
  if (mUnd) return normalizeClientId(mUnd[1]);

  const mDash = id.match(/^([A-Za-z0-9_]+)-/);
  if (mDash) return normalizeClientId(mDash[1]);

  return "";
}

function pickClientLabel(c: ClientProfile): string {
  const name = (c.name ?? "").trim() || c.id;
  return `${name} (${c.id})`;
}

export default function DayDashboardPage(): JSX.Element {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const tasksByClient = useMemo(() => {
    const m = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      const cid = deriveTaskClientId(t);
      if (!cid) continue;
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid)!.push(t);
    }
    return m;
  }, [tasks]);

  const procByClient = useMemo(() => {
    const m = new Map<string, ProcessInstance[]>();
    for (const p of processes) {
      const cid = deriveProcessClientId(p);
      if (!cid) continue;
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid)!.push(p);
    }
    return m;
  }, [processes]);

  useEffect(() => {
    let alive = true;

    async function load(): Promise<void> {
      const errs: string[] = [];
      try {
        const c = await apiGetJson("/api/internal/client-profiles");
        const list: ClientProfile[] = (c?.value ?? c ?? []) as any;
        if (alive) setClients(Array.isArray(list) ? list : []);
      } catch (e: any) {
        errs.push(`client-profiles: ${e?.message ?? "failed"}`);
        if (alive) setClients([]);
      }

      try {
        const t = await apiGetJson("/api/internal/tasks");
        const list: TaskItem[] = (t?.value ?? t ?? []) as any;
        if (alive) setTasks(Array.isArray(list) ? list : []);
      } catch (e: any) {
        errs.push(`tasks: ${e?.message ?? "failed"}`);
        if (alive) setTasks([]);
      }

      try {
        const p = await apiGetJson("/api/internal/process-instances-v2");
        const list: ProcessInstance[] = (p?.value ?? p ?? []) as any;
        if (alive) setProcesses(Array.isArray(list) ? list : []);
      } catch (e: any) {
        errs.push(`process-instances-v2: ${e?.message ?? "failed"}`);
        if (alive) setProcesses([]);
      }

      if (alive) setErrors(errs);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (selectedClientId) return;
    if (clients.length === 1) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const visibleTasks = useMemo(() => {
    if (!selectedClientId) return [];
    return tasksByClient.get(selectedClientId) ?? [];
  }, [selectedClientId, tasksByClient]);

  const visibleProcs = useMemo(() => {
    if (!selectedClientId) return [];
    return procByClient.get(selectedClientId) ?? [];
  }, [selectedClientId, procByClient]);

  const anyTaskClientIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) {
      const cid = deriveTaskClientId(t);
      if (cid) s.add(cid);
    }
    return Array.from(s.values()).sort();
  }, [tasks]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Day</h2>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Client</span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{ padding: "6px 8px" }}
          >
            <option value="">(none)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {pickClientLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errors.length > 0 && (
        <div
          style={{
            border: "1px solid #f0c36d",
            background: "#fff7e6",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Data endpoints have issues.</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Clients</div>
          {clients.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>No clients</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {clients.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedClientId(c.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      textDecoration: selectedClientId === c.id ? "underline" : "none",
                    }}
                  >
                    {c.name ?? c.id}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Tasks</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {selectedClientId ? `for ${selectedClientId}` : "select a client"}
            </div>
          </div>

          {!selectedClientId ? (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Select a client</div>
          ) : visibleTasks.length === 0 ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Empty</div>
              {tasks.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                  Backend has tasks for: {anyTaskClientIds.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
              {visibleTasks.map((t) => (
                <li key={`${t.id}-${t.created_at ?? ""}`}>
                  <span style={{ fontWeight: 600 }}>{t.title ?? t.id}</span>{" "}
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {t.status ? `[${t.status}]` : ""} {t.due_date ? `due ${t.due_date}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Process instances</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {selectedClientId ? `for ${selectedClientId}` : "select a client"}
            </div>
          </div>

          {!selectedClientId ? (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Select a client</div>
          ) : visibleProcs.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Empty</div>
          ) : (
            <ul style={{ margin: "8px 0 0 0", paddingLeft: 16 }}>
              {visibleProcs.map((p) => (
                <li key={p.id}>
                  <span style={{ fontWeight: 600 }}>{p.id}</span>{" "}
                  <span style={{ fontSize: 12, opacity: 0.7 }}>
                    {p.status ? `[${p.status}]` : ""} {p.source ? `src ${p.source}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
