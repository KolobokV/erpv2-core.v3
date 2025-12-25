export interface ProcessStageTemplate {
  id?: string;
  title: string;
  order: number;
  description?: string | null;
  default_deadline_offset_days?: number | null;
}

export interface ProcessDefinition {
  id: string;
  name: string;
  description?: string | null;
  scope?: string | null;
  period_type?: string | null;
  stages?: ProcessStageTemplate[] | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessStageInstance {
  id?: string;
  title: string;
  order: number;
  status: string;
  description?: string | null;
  deadline?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface ProcessInstance {
  id: string;
  definition_id: string;
  client_profile_id?: string | null;
  period_key?: string | null;
  status: string;
  stages?: ProcessStageInstance[] | null;
  meta?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

interface ProcessDefinitionListResponse {
  ok: boolean;
  error?: string | null;
  items: ProcessDefinition[];
}

interface ProcessInstanceListResponse {
  ok: boolean;
  error?: string | null;
  items: ProcessInstance[];
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch (err) {
    console.error("internalProcessesApi: json parse error", err);
    return null;
  }
}

export async function fetchProcessDefinitions(): Promise<ProcessDefinition[]> {
  try {
    const res = await fetch("/api/internal/process-definitions");
    if (!res.ok) {
      console.warn("fetchProcessDefinitions: http", res.status);
      return [];
    }
    const data = await safeJson<ProcessDefinitionListResponse>(res);
    if (!data || !data.ok || !Array.isArray(data.items)) {
      return [];
    }
    return data.items;
  } catch (err) {
    console.error("fetchProcessDefinitions error", err);
    return [];
  }
}

export async function fetchProcessInstances(): Promise<ProcessInstance[]> {
  try {
    const res = await fetch("/api/internal/process-instances");
    if (!res.ok) {
      console.warn("fetchProcessInstances: http", res.status);
      return [];
    }
    const data = await safeJson<ProcessInstanceListResponse>(res);
    if (!data || !data.ok || !Array.isArray(data.items)) {
      return [];
    }
    return data.items;
  } catch (err) {
    console.error("fetchProcessInstances error", err);
    return [];
  }
}
