export type OnboardingClient = {
  clientId: string;
  createdAtIso: string;
};

const KEY_LIST = "erpv2_onboarding_clients_v1";
const KEY_LAST = "erpv2_last_active_client_v1";

export function addOnboardingClient(clientId: string): void {
  const now = new Date().toISOString();
  const item: OnboardingClient = { clientId, createdAtIso: now };
  const list = getOnboardingClients();
  const next = [item, ...list.filter(x => x.clientId !== clientId)].slice(0, 50);
  localStorage.setItem(KEY_LIST, JSON.stringify(next));
  localStorage.setItem(KEY_LAST, clientId);
}

export function getOnboardingClients(): OnboardingClient[] {
  try {
    const raw = localStorage.getItem(KEY_LIST);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x.clientId === "string" && typeof x.createdAtIso === "string")
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function setLastActiveClient(clientId: string): void {
  localStorage.setItem(KEY_LAST, clientId);
}

export function getLastActiveClient(): string | null {
  const v = localStorage.getItem(KEY_LAST);
  return v && v.trim() ? v : null;
}