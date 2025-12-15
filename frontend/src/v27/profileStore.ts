import type { ClientProfileV27, ReglementItemDerived } from "./types";

/* ========= TYPES ========= */

export type V27MaterializeMeta = {
  count: number;
  last_materialize_at_iso: string | null;
  last_materialize_error: string | null;
};

export type V27TaskLocal = {
  id: string;
  key: string;
  title: string;
  source: "v27_derived";
  periodicity?: string;
  reason?: string;
  deadline?: string | null;
  completed: boolean;
  created_at_iso: string;
};

/* ========= KEYS ========= */

const keyProfile = (clientId: string) => "v27_profile_" + clientId;
const keyTasks = (clientId: string) => "v27_tasks_" + clientId;
const keyMeta = (clientId: string) => "v27_materialize_meta_" + clientId;

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

/* ========= DATE HELPERS ========= */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const y = x.getFullYear();
  const m = x.getMonth() + months;
  x.setFullYear(y, m, 1);
  return x;
}

function endOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return x;
}

function quarterOfMonth0(m0: number): number {
  if (m0 <= 2) return 1;
  if (m0 <= 5) return 2;
  if (m0 <= 8) return 3;
  return 4;
}

function quarterEndMonth0(q: number): number {
  if (q === 1) return 2;
  if (q === 2) return 5;
  if (q === 3) return 8;
  return 11;
}

/*
  Compute deadlines (best-effort, frontend-only).
  Rules are intentionally simple and deterministic.
*/
function computeDeadlineIso(key: string, periodicity?: string): string | null {
  const now = new Date();

  // Specific keys (preferred)
  if (key === "tax.usn.advance") {
    // USN advance: 25th of month following quarter end
    const q = quarterOfMonth0(now.getMonth());
    const qEndM0 = quarterEndMonth0(q);
    const qEnd = new Date(now.getFullYear(), qEndM0, 1);
    const dueBase = addMonths(qEnd, 1);
    const due = new Date(dueBase.getFullYear(), dueBase.getMonth(), 25);
    return toIsoDateOnly(due);
  }

  if (key === "tax.usn.year") {
    // USN annual declaration: Apr 30 next year (generic)
    const due = new Date(now.getFullYear() + 1, 3, 30);
    return toIsoDateOnly(due);
  }

  if (key === "bank.statement.request") {
    // Request statement: 5th of next month (generic operational)
    const dueBase = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1);
    const due = new Date(dueBase.getFullYear(), dueBase.getMonth(), 5);
    return toIsoDateOnly(due);
  }

  // Fallback by periodicity if key unknown
  if (periodicity === "MONTHLY") {
    const dueBase = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1);
    const due = new Date(dueBase.getFullYear(), dueBase.getMonth(), 5);
    return toIsoDateOnly(due);
  }

  if (periodicity === "QUARTERLY") {
    const q = quarterOfMonth0(now.getMonth());
    const qEndM0 = quarterEndMonth0(q);
    const qEnd = new Date(now.getFullYear(), qEndM0, 1);
    const dueBase = addMonths(qEnd, 1);
    const due = new Date(dueBase.getFullYear(), dueBase.getMonth(), 25);
    return toIsoDateOnly(due);
  }

  if (periodicity === "YEARLY") {
    const due = new Date(now.getFullYear() + 1, 3, 30);
    return toIsoDateOnly(due);
  }

  // No deadline known
  return null;
}

/* ========= PROFILE ========= */

export function loadClientProfileV27(clientId: string): ClientProfileV27 {
  const raw = readJson(keyProfile(clientId));
  return (
    raw ?? {
      clientId,
      legal: { entityType: "IP", taxSystem: "USN_DR", vatMode: "NONE" },
      employees: { hasPayroll: false, headcount: 0, payrollDates: [] },
      operations: { bankAccounts: 1, cashRegister: false, ofd: false, foreignOps: false },
      specialFlags: { tourismTax: false, excise: false, controlledTransactions: false },
      updatedAtIso: new Date().toISOString(),
    }
  );
}

export function saveClientProfileV27(profile: ClientProfileV27): ClientProfileV27 {
  writeJson(keyProfile(profile.clientId), profile);
  return profile;
}

export function resetClientProfileV27(clientId: string) {
  removeKey(keyProfile(clientId));
  return { ok: true };
}

/* ========= META ========= */

export function loadMaterializeMetaV27(clientId: string): V27MaterializeMeta {
  const raw = readJson(keyMeta(clientId));
  return (
    raw ?? {
      count: 0,
      last_materialize_at_iso: null,
      last_materialize_error: null,
    }
  );
}

function saveMaterializeMetaV27(clientId: string, meta: V27MaterializeMeta): V27MaterializeMeta {
  writeJson(keyMeta(clientId), meta);
  return meta;
}

/* ========= DERIVED -> LOCAL TASKS ========= */

function safeKeyFromDerived(d: any, idx: number): string {
  const k = String(d?.key ?? "").trim();
  if (k) return k;
  return "derived.unknown." + String(idx);
}

function dedupeByKey(tasks: V27TaskLocal[]): V27TaskLocal[] {
  const map = new Map<string, V27TaskLocal>();
  for (const t of tasks) {
    if (!map.has(t.key)) map.set(t.key, t);
  }
  return Array.from(map.values());
}

export function materializeFromDerivedV27(clientId: string, derived: ReglementItemDerived[]): V27TaskLocal[] {
  const nowIso = new Date().toISOString();

  if (!clientId) {
    const meta: V27MaterializeMeta = {
      count: 0,
      last_materialize_at_iso: nowIso,
      last_materialize_error: "missing_client_id",
    };
    saveMaterializeMetaV27(clientId, meta);
    return [];
  }

  try {
    const rawTasks: V27TaskLocal[] = (derived || []).map((d: any, idx: number) => {
      const key = safeKeyFromDerived(d, idx);
      const periodicity = String(d?.periodicity ?? "").trim() || undefined;
      const reason = String(d?.reason ?? "").trim() || undefined;
      const deadline = computeDeadlineIso(key, periodicity);

      return {
        id: "v27_" + key,
        key,
        title: String(d?.title ?? key),
        source: "v27_derived",
        periodicity,
        reason,
        deadline,
        completed: false,
        created_at_iso: nowIso,
      };
    });

    const tasks = dedupeByKey(rawTasks);

    writeJson(keyTasks(clientId), tasks);

    const meta: V27MaterializeMeta = {
      count: tasks.length,
      last_materialize_at_iso: nowIso,
      last_materialize_error: null,
    };
    saveMaterializeMetaV27(clientId, meta);

    return tasks;
  } catch {
    const meta: V27MaterializeMeta = {
      count: 0,
      last_materialize_at_iso: nowIso,
      last_materialize_error: "error",
    };
    saveMaterializeMetaV27(clientId, meta);
    return [];
  }
}

export function loadMaterializedTasksV27(clientId: string): V27TaskLocal[] {
  const v = readJson(keyTasks(clientId));
  return Array.isArray(v) ? v : [];
}

export function resetMaterializedTasksV27(clientId: string): { ok: boolean; key: string } {
  const k = keyTasks(clientId);
  removeKey(k);

  const meta: V27MaterializeMeta = {
    count: 0,
    last_materialize_at_iso: new Date().toISOString(),
    last_materialize_error: null,
  };
  saveMaterializeMetaV27(clientId, meta);

  return { ok: true, key: k };
}