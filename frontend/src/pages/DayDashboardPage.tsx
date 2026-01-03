import React, { useEffect, useMemo, useState } from "react";
import { apiGetJson } from "../lib/api";
import TaskCard from "../components/tasks/TaskCard";
import TaskSectionHeader from "../components/tasks/TaskSectionHeader";
import { groupTasksByDeadline } from "../ui/taskGrouping";

type ClientProfile = {
  id: string;
  name: string;
};

type TaskItem = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  due_date?: string;
  created_at?: string;
  client_id?: string;
  priority?: "low" | "medium" | "high" | "urgent";
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

  const mDemo = id.match(/^task-demo-client-(\d+)-/);
  if (mDemo) return `demo_client_${mDemo[1]}`;

  const m = id.match(/^task-([A-Za-z0-9_]+)-/);
  if (m) return normalizeClientId(m[1]);

  return "";
}

function deriveProcessClientId(p: ProcessInstance): string {
  const direct = (p.client_id ?? p.profile_id ?? "").trim();
  if (direct) return normalizeClientId(direct);

  const id = (p.id ?? "").trim();
  if (!id) return "";

  const mUnd = id.match(/^([A-Za-z0-9_]+)__/);
  if (mUnd) return normalizeClientId(mUnd[1]);

  const mDash = id.match(/^([A-Za-z0-9_]+)-/);
  if (mDash) return normalizeClientId(mDash[1]);

  return "";
}

function makeRenderKey(t: TaskItem, idx: number): string {
  const id = (t.id ?? "").trim() || `noid-${idx}`;
  const created = (t.created_at ?? "").trim();
  if (created) return `${id}__${created}`;
  return `${id}__idx_${idx}`;
}

function getBackendBaseUrl(): string {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
  if (typeof envBase === "string" && envBase.trim()) return envBase.trim();

  const host = window.location.hostname || "localhost";
  return `http://${host}:8000`;
}

async function httpJson(method: string, url: string, body: any): Promise<Response> {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function trySetTaskStatus(taskId: string, status: string): Promise<void> {
  const base = getBackendBaseUrl();
  const body = { status };

  const urlPut = `${base}/api/internal/tasks/${encodeURIComponent(taskId)}/status`;
  const r1 = await httpJson("PUT", urlPut, body);
  if (r1.ok) return;

  const urlPost = `${base}/api/internal/tasks/${encodeURIComponent(taskId)}`;
  const r2 = await httpJson("POST", urlPost, body);
  if (r2.ok) return;

  throw new Error(`Status update failed: PUT ${r1.status}, POST ${r2.status}`);
}

export default function DayDashboardPage(): JSX.Element {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");

  useEffect(() => {
    apiGetJson("/api/internal/client-profiles").then((r) => {
      const list = (r?.items ?? r?.value ?? r) as any;
      setClients(Array.isArray(list) ? list : []);
    });

    apiGetJson("/api/internal/tasks").then((r) => {
      const list = (r?.items ?? r?.value ?? r) as any;
      setTasks(Array.isArray(list) ? list : []);
    });

    apiGetJson("/api/internal/process-instances-v2").then((r) => {
      const list = (r?.items ?? r?.value ?? r) as any;
      setProcesses(Array.isArray(list) ? list : []);
    });
  }, []);

  useEffect(() => {
    if (selectedClientId) return;
    if (clients.length === 1) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const visibleTasks = useMemo(() => {
    if (!selectedClientId) return [];
    return tasks.filter((t) => deriveTaskClientId(t) === selectedClientId);
  }, [tasks, selectedClientId]);

  const taskSections = useMemo(() => {
    const mapped = visibleTasks.map((t) => ({ task: t, deadline: t.due_date ?? null }));
    const grouped = groupTasksByDeadline(mapped);
    return {
      overdue: grouped.overdue.map((x) => x.task),
      today: grouped.today.map((x) => x.task),
      upcoming: grouped.upcoming.map((x) => x.task),
    };
  }, [visibleTasks]);

  const visibleProcs = useMemo(() => {
    if (!selectedClientId) return [];
    return processes.filter((p) => deriveProcessClientId(p) === selectedClientId);
  }, [processes, selectedClientId]);

  async function onSetStatus(taskId: string, nextStatus: string): Promise<void> {
    setActionError("");

    const prev = tasks;
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t));
    setTasks(updated);

    try {
      await trySetTaskStatus(taskId, nextStatus);
    } catch (e: any) {
      setTasks(prev);
      setActionError(e?.message ?? "status update failed");
    }
  }

  function renderTaskSection(title: string, items: TaskItem[]): JSX.Element | null {
    if (items.length === 0) return null;
    return (
      <div>
        <TaskSectionHeader title={title} count={items.length} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((t, idx) => (
            <TaskCard
              key={makeRenderKey(t, idx)}
              task={{
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority ?? "medium",
                deadline: t.due_date,
                client_id: deriveTaskClientId(t),
              }}
              compact={true}
              onSetStatus={onSetStatus}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Day</h2>
        <div style={{ flex: 1 }} />
        <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", minWidth: 260 }}>
          <option value="">(select client)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {actionError ? (
        <div style={{ marginBottom: 12, border: "1px solid #f0c36d", background: "#fff7e6", padding: 10, borderRadius: 8, fontSize: 12 }}>
          Action failed: {actionError}
        </div>
      ) : null}

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
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Empty</div>
          ) : (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
              {renderTaskSection("Overdue", taskSections.overdue)}
              {renderTaskSection("Today", taskSections.today)}
              {renderTaskSection("Upcoming", taskSections.upcoming)}
            </div>
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
