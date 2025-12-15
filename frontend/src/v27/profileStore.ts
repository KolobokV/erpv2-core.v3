import type { ClientProfileV27, ReglementItemDerived } from "./types";

/* ========= TYPES ========= */

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

export type V27MaterializeMeta = {
  count: number;
  last_materialize_at_iso: string | null;
  last_materialize_error: string | null;
};

/* ========= KEYS ========= */

const keyProfile = (clientId: string) => "v27_profile_" + clientId;
const keyTasks = (clientId: string) => "v27_tasks_" + clientId;
const keyMeta = (clientId: string) => "v27_tasks_meta_" + clientId;

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

/* ========= META ========= */

function normalizeMeta(x: any): V27MaterializeMeta {
  const obj = x && typeof x === "object" ? x : {};
  return {
    count: typeof obj.count === "number" ? obj.count : 0,
    last_materialize_at_iso: typeof obj.last_materialize_at_iso === "string" ? obj.last_materialize_at_iso : null,
    last_materialize_error: typeof obj.last_materialize_error === "string" ? obj.last_materialize_error : null,
  };
}

export function loadMaterializeMetaV27(clientId: string): V27MaterializeMeta {
  const raw = readJson(keyMeta(clientId));
  if (!raw) return { count: 0, last_materialize_at_iso: null, last_materialize_error: null };
  return normalizeMeta(raw);
}

function saveMaterializeMetaV27(clientId: string, meta: V27MaterializeMeta) {
  writeJson(keyMeta(clientId), meta);
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

/* ========= DERIVED -> LOCAL TASKS ========= */

function safeKeyFromDerived(d: any, idx: number): string {
  const k = typeof d?.key === "string" ? d.key.trim() : "";
  if (k) return k;
  return "derived_" + String(idx);
}

function dateOnlyIso(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function computeDeadlineIso(key: string, periodicity?: string): string | null {
  const now = new Date();
  const p = String(periodicity ?? "").toUpperCase();

  // MONTHLY: 5th of next month
  if (p === "MONTHLY" || key.includes("bank.statement")) {
    const n = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1);
    const due = new Date(n.getFullYear(), n.getMonth(), 5);
    return dateOnlyIso(due);
  }

  // QUARTERLY: 25th of next quarter first month (USN advance)
  if (p === "QUARTERLY" || key.includes("tax.usn.advance")) {
    const m = now.getMonth() + 1; // 1..12
    let dueY = now.getFullYear();
    let dueM = 1;

    if (m <= 3) dueM = 4;       // Apr
    else if (m <= 6) dueM = 7;  // Jul
    else if (m <= 9) dueM = 10; // Oct
    else { dueM = 1; dueY = dueY + 1; } // Jan next year

    const due = new Date(dueY, dueM - 1, 25);
    return dateOnlyIso(due);
  }

  // YEARLY: Apr 30 of next year (USN annual)
  if (p === "YEARLY" || key.includes("tax.usn.year")) {
    const y = now.getFullYear() + 1;
    const due = new Date(y, 3, 30); // Apr=3
    return dateOnlyIso(due);
  }

  return null;
}

function normalizeTasksArray(x: any): V27TaskLocal[] {
  if (!Array.isArray(x)) return [];
  return x.filter(Boolean).map((t: any) => {
    const key = typeof t?.key === "string" ? t.key : "";
    const created = typeof t?.created_at_iso === "string" ? t.created_at_iso : new Date().toISOString();
    return {
      id: String(t?.id ?? ("v27_" + key)),
      key: String(key),
      title: String(t?.title ?? key),
      source: "v27_derived",
      periodicity: typeof t?.periodicity === "string" ? t.periodicity : undefined,
      reason: typeof t?.reason === "string" ? t.reason : undefined,
      deadline: typeof t?.deadline === "string" ? t.deadline : (t?.deadline === null ? null : undefined),
      completed: !!t?.completed,
      created_at_iso: created,
    } as V27TaskLocal;
  });
}

function dedupeByKey(tasks: V27TaskLocal[]): V27TaskLocal[] {
  const map = new Map<string, V27TaskLocal>();
  for (const t of tasks) {
    if (!map.has(t.key)) map.set(t.key, t);
  }
  return Array.from(map.values());
}

/**
 * Materialize (merge) tasks from derived.
 * - preserves existing completed + created_at_iso
 * - updates title/periodicity/reason/deadline from current derived
 * - idempotent: repeated runs produce same result (except timestamps in meta)
 */
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
    const existing = normalizeTasksArray(readJson(keyTasks(clientId)));
    const byKey = new Map<string, V27TaskLocal>();
    for (const t of existing) byKey.set(t.key, t);

    const incoming: V27TaskLocal[] = (derived || []).map((d: any, idx: number) => {
      const key = safeKeyFromDerived(d, idx);
      const periodicity = String(d?.periodicity ?? "").trim() || undefined;
      const reason = String(d?.reason ?? "").trim() || undefined;
      const deadline = computeDeadlineIso(key, periodicity);

      const prev = byKey.get(key);
      const completed = prev ? !!prev.completed : false;
      const created_at_iso = prev ? prev.created_at_iso : nowIso;

      return {
        id: "v27_" + key,
        key,
        title: String(d?.title ?? key),
        source: "v27_derived",
        periodicity,
        reason,
        deadline,
        completed,
        created_at_iso,
      };
    });

    const tasks = dedupeByKey(incoming);

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
  return normalizeTasksArray(v);
}

/**
 * Reset (delete) all locally materialized v27 tasks for client.
 * Local only. Safe to call multiple times.
 */
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