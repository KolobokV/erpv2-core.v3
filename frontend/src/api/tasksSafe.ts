import { safeFetchJson } from "./safeFetch";

export type TaskItem = {
  id?: string;
  title?: string;
  status?: string;
  deadline?: string;
  client_id?: string;
};

export type TasksResponse = {
  tasks: TaskItem[];
};

const EMPTY: TasksResponse = { tasks: [] };

function normalizeTasks(raw: any): TaskItem[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.tasks)) return raw.tasks;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

export async function fetchTasksSafe(): Promise<TasksResponse> {
  // NOTE: internal endpoint is canonical for current ERPv2.
  const raw = await safeFetchJson<any>("/api/internal/tasks", EMPTY);
  return { tasks: normalizeTasks(raw) };
}
