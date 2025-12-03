export interface TaskItem {
  id: number | string;
  title: string;
  assignee?: string | null;
  client?: string | null;
  status?: string | null;
  due_date?: string | null;
  source?: string | null;
}

export interface TasksResponse {
  items: TaskItem[];
  total?: number;
  active?: number;
}

export interface TasksReportItem {
  assignee: string;
  total: number;
  active: number;
  done: number;
}

export interface TasksReportResponse {
  date?: string;
  items: TasksReportItem[];
}

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://host.docker.internal:8000";

async function getJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) {
    throw new Error(`Request failed with status code ${resp.status}`);
  }
  return (await resp.json()) as T;
}

function normalizeTasksResponse(raw: any): TasksResponse {
  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length };
  }
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const total = typeof raw?.total === "number" ? raw.total : items.length;
  const active = typeof raw?.active === "number" ? raw.active : undefined;
  return { items, total, active };
}

export async function fetchTasksToday(): Promise<TasksResponse> {
  const raw = await getJson<any>("/api/tasks/today");
  return normalizeTasksResponse(raw);
}

export async function fetchTasksAll(): Promise<TasksResponse> {
  const raw = await getJson<any>("/api/tasks");
  return normalizeTasksResponse(raw);
}

export async function fetchTasksReportToday(): Promise<TasksReportResponse> {
  const raw = await getJson<any>("/api/tasks/report/today_by_assignee");
  if (Array.isArray(raw)) {
    return { items: raw as TasksReportItem[] };
  }
  return {
    date: typeof raw?.date === "string" ? raw.date : undefined,
    items: Array.isArray(raw?.items) ? (raw.items as TasksReportItem[]) : [],
  };
}

export async function downloadTasksCsv(): Promise<Blob> {
  const resp = await fetch(`${API_BASE}/api/tasks/export`);
  if (!resp.ok) {
    throw new Error(`Request failed with status code ${resp.status}`);
  }
  return await resp.blob();
}