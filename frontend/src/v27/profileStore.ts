import type { ClientProfileV27, ReglementItemDerived } from "./types";

/* ========= TYPES ========= */

export type V27TaskLocal = {
  id: string;
  title: string;
  source: "v27_derived";
  completed: boolean;
};

/* ========= KEYS ========= */

const keyProfile = (clientId: string) => "v27_profile_" + clientId;
const keyTasks = (clientId: string) => "v27_tasks_" + clientId;

/* ========= STORAGE HELPERS ========= */

function readJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key: string) {
  localStorage.removeItem(key);
}

/* ========= PROFILE ========= */

export function loadClientProfileV27(clientId: string): ClientProfileV27 {
  const raw = readJson(keyProfile(clientId));
  return raw ?? {
    clientId,
    legal: { entityType: "IP", taxSystem: "USN_DR", vatMode: "NONE" },
    employees: { hasPayroll: false, headcount: 0, payrollDates: [] },
    operations: { bankAccounts: 1, cashRegister: false, ofd: false, foreignOps: false },
    specialFlags: { tourismTax: false, excise: false, controlledTransactions: false },
    updatedAtIso: new Date().toISOString()
  };
}

export function saveClientProfileV27(profile: ClientProfileV27): ClientProfileV27 {
  writeJson(keyProfile(profile.clientId), profile);
  return profile;
}

export function resetClientProfileV27(clientId: string) {
  removeKey(keyProfile(clientId));
  return { ok: true };
}

/* ========= DERIVED → LOCAL TASKS ========= */

export function materializeFromDerivedV27(
  clientId: string,
  derived: ReglementItemDerived[]
): V27TaskLocal[] {
  const tasks: V27TaskLocal[] = (derived || []).map((d) => ({
    id: "v27_" + d.key,
    title: d.title,
    source: "v27_derived",
    completed: false
  }));

  writeJson(keyTasks(clientId), tasks);
  return tasks;
}

export function loadMaterializedTasksV27(clientId: string): V27TaskLocal[] {
  return readJson(keyTasks(clientId)) ?? [];
}

/**
 * Reset (delete) all locally materialized v27 tasks for client.
 * Local only. Safe to call multiple times.
 */
export function resetMaterializedTasksV27(clientId: string): { ok: boolean; key: string } {
  const key = keyTasks(clientId);
  removeKey(key);
  return { ok: true, key };
}