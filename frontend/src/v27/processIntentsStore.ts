export type ProcessIntent = {
  taskKey: string;
  createdAtIso: string;
};

type StoreShape = {
  v: number;
  byClient: Record<string, Record<string, ProcessIntent>>;
};

const LS_KEY = "erpv2_v27_process_intents_v1";
const DEFAULT: StoreShape = { v: 1, byClient: {} };

function safeParse(json: string | null): any {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadStore(): StoreShape {
  const raw = safeParse(localStorage.getItem(LS_KEY));
  if (!raw || typeof raw !== "object") return { ...DEFAULT };
  const byClient = raw.byClient && typeof raw.byClient === "object" ? raw.byClient : {};
  return { v: 1, byClient };
}

function saveStore(s: StoreShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function normClientId(clientId: string): string {
  return String(clientId ?? "").trim();
}

function normTaskKey(taskKey: string): string {
  return String(taskKey ?? "").trim();
}

export function listProcessIntents(clientId: string): ProcessIntent[] {
  const cid = normClientId(clientId);
  if (!cid) return [];
  const s = loadStore();
  const m = s.byClient[cid];
  if (!m || typeof m !== "object") return [];
  return Object.values(m).sort((a, b) => String(a.createdAtIso).localeCompare(String(b.createdAtIso)));
}

export function countProcessIntents(clientId: string): number {
  return listProcessIntents(clientId).length;
}

export function hasProcessIntent(clientId: string, taskKey: string): boolean {
  const cid = normClientId(clientId);
  const k = normTaskKey(taskKey);
  if (!cid || !k) return false;
  const s = loadStore();
  return !!s.byClient?.[cid]?.[k];
}

export function addProcessIntent(clientId: string, taskKey: string): void {
  const cid = normClientId(clientId);
  const k = normTaskKey(taskKey);
  if (!cid || !k) return;

  const s = loadStore();
  if (!s.byClient[cid]) s.byClient[cid] = {};
  if (!s.byClient[cid][k]) {
    s.byClient[cid][k] = { taskKey: k, createdAtIso: new Date().toISOString() };
    saveStore(s);
  }
}

export function removeProcessIntent(clientId: string, taskKey: string): void {
  const cid = normClientId(clientId);
  const k = normTaskKey(taskKey);
  if (!cid || !k) return;

  const s = loadStore();
  if (s.byClient?.[cid]?.[k]) {
    delete s.byClient[cid][k];
    saveStore(s);
  }
}

export function clearProcessIntents(clientId: string): void {
  const cid = normClientId(clientId);
  if (!cid) return;
  const s = loadStore();
  if (s.byClient[cid]) {
    delete s.byClient[cid];
    saveStore(s);
  }
}