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

export async function fetchTasksSafe() {
  return safeFetchJson<TasksResponse>("/api/tasks", EMPTY);
}