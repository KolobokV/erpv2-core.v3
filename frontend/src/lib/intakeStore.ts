export type IntakeStored = {
  clientId: string;
  taxMode: string;
  employees: number;
  payrollDay1: number;
  payrollDay2: number;
  savedAtIso: string;
};

const KEY = "erpv2_intake_store_v1";

export function saveIntake(v: Omit<IntakeStored, "savedAtIso">): void {
  const now = new Date().toISOString();
  const item: IntakeStored = { ...v, savedAtIso: now };
  const map = loadAll();
  map[v.clientId] = item;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function loadIntake(clientId: string): IntakeStored | null {
  const map = loadAll();
  return map[clientId] || null;
}

function loadAll(): Record<string, IntakeStored> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, IntakeStored>;
  } catch {
    return {};
  }
}