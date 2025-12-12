import { ClientProfileV27, makeDefaultClientProfileV27 } from "./types";

const LS_PREFIX = "erpv2.v27.clientProfile.";
const LS_TASKS_PREFIX = "erpv2.v27.materializedTasks.";

export type V27MaterializedTask = {
  id: string;
  client: string;
  title: string;
  status: string;
  due_date: string | null;
  source: "v27_local";
  created_at_iso: string;
  updated_at_iso: string;
};

export const getClientProfileKeyV27 = (clientId: string): string => {
  return LS_PREFIX + clientId;
};

export const getMaterializedTasksKeyV27 = (clientId: string): string => {
  return LS_TASKS_PREFIX + clientId;
};

export const tryReadRawClientProfileV27 = (clientId: string): { ok: boolean; raw: string | null; error?: string } => {
  const key = getClientProfileKeyV27(clientId);
  try {
    const raw = window.localStorage.getItem(key);
    return { ok: true, raw };
  } catch (e: any) {
    return { ok: false, raw: null, error: String(e?.message || e) };
  }
};

export const loadClientProfileV27 = (clientId: string): ClientProfileV27 => {
  const res = tryReadRawClientProfileV27(clientId);
  if (!res.ok || !res.raw) return makeDefaultClientProfileV27(clientId);

  try {
    const parsed = JSON.parse(res.raw) as ClientProfileV27;
    if (!parsed || parsed.clientId !== clientId) return makeDefaultClientProfileV27(clientId);
    return parsed;
  } catch {
    return makeDefaultClientProfileV27(clientId);
  }
};

export const saveClientProfileV27 = (
  profile: ClientProfileV27
): { ok: boolean; key: string; size: number; error?: string } => {
  const key = getClientProfileKeyV27(profile.clientId);
  const safe: ClientProfileV27 = { ...profile, updatedAtIso: new Date().toISOString() };

  let raw = "";
  try {
    raw = JSON.stringify(safe);
  } catch (e: any) {
    return { ok: false, key, size: 0, error: "json_error:" + String(e?.message || e) };
  }

  try {
    window.localStorage.setItem(key, raw);
    return { ok: true, key, size: raw.length };
  } catch (e: any) {
    return { ok: false, key, size: raw.length, error: "storage_error:" + String(e?.message || e) };
  }
};

export const resetClientProfileV27 = (
  clientId: string
): { profile: ClientProfileV27; result: { ok: boolean; key: string; size: number; error?: string } } => {
  const fresh = makeDefaultClientProfileV27(clientId);
  const result = saveClientProfileV27(fresh);
  return { profile: fresh, result };
};

function normText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(clientId: string, title: string): string {
  const base = normText(clientId + "::" + title);
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return "v27_" + h.toString(16);
}

function cadenceToDueDateIso(cadence: string): string | null {
  const c = normText(cadence);
  const now = new Date();
  let days = 7;
  if (c.includes("quarter")) days = 14;
  if (c.includes("year")) days = 30;
  if (c.includes("month")) days = 7;
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export const loadMaterializedTasksV27 = (
  clientId: string
): { ok: boolean; key: string; items: V27MaterializedTask[]; error?: string } => {
  const key = getMaterializedTasksKeyV27(clientId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ok: true, key, items: [] };
    const parsed = JSON.parse(raw) as V27MaterializedTask[];
    if (!Array.isArray(parsed)) return { ok: false, key, items: [], error: "bad_shape" };
    const safe = parsed.filter((x) => x && x.client === clientId && x.source === "v27_local");
    return { ok: true, key, items: safe };
  } catch (e: any) {
    return { ok: false, key, items: [], error: String(e?.message || e) };
  }
};

export const saveMaterializedTasksV27 = (
  clientId: string,
  items: V27MaterializedTask[]
): { ok: boolean; key: string; size: number; error?: string } => {
  const key = getMaterializedTasksKeyV27(clientId);
  let raw = "";
  try {
    raw = JSON.stringify(items || []);
  } catch (e: any) {
    return { ok: false, key, size: 0, error: "json_error:" + String(e?.message || e) };
  }
  try {
    window.localStorage.setItem(key, raw);
    return { ok: true, key, size: raw.length };
  } catch (e: any) {
    return { ok: false, key, size: raw.length, error: "storage_error:" + String(e?.message || e) };
  }
};

export const resetMaterializedTasksV27 = (clientId: string): { ok: boolean; key: string; size: number; error?: string } => {
  return saveMaterializedTasksV27(clientId, []);
};

export const materializeFromDerivedV27 = (
  clientId: string,
  derivedItems: Array<{ title: string; cadence?: string }>
): { ok: boolean; key: string; size: number; created: number; updated: number; error?: string } => {
  const nowIso = new Date().toISOString();
  const existing = loadMaterializedTasksV27(clientId);
  const prev = existing.ok ? existing.items : [];

  const byId = new Map<string, V27MaterializedTask>();
  prev.forEach((t) => byId.set(t.id, t));

  let created = 0;
  let updated = 0;

  const next: V27MaterializedTask[] = [];

  derivedItems.forEach((d) => {
    const title = String(d.title || "Untitled");
    const cadence = String(d.cadence || "");
    const id = stableId(clientId, title);
    const due = cadenceToDueDateIso(cadence);

    const prevTask = byId.get(id);
    if (!prevTask) {
      created++;
      next.push({
        id,
        client: clientId,
        title,
        status: "open",
        due_date: due,
        source: "v27_local",
        created_at_iso: nowIso,
        updated_at_iso: nowIso,
      });
      return;
    }

    const changed = prevTask.title !== title || prevTask.due_date !== due;
    if (changed) updated++;

    next.push({
      ...prevTask,
      title,
      due_date: due,
      updated_at_iso: nowIso,
    });
  });

  const saveRes = saveMaterializedTasksV27(clientId, next);
  if (!saveRes.ok) return { ok: false, key: saveRes.key, size: saveRes.size, created, updated, error: saveRes.error };

  return { ok: true, key: saveRes.key, size: saveRes.size, created, updated };
};