import { ClientProfileV27, makeDefaultClientProfileV27 } from "./types";

const LS_PREFIX = "erpv2.v27.clientProfile.";

export const getClientProfileKeyV27 = (clientId: string): string => {
  return LS_PREFIX + clientId;
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

export const saveClientProfileV27 = (profile: ClientProfileV27): { ok: boolean; key: string; size: number; error?: string } => {
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

export const resetClientProfileV27 = (clientId: string): { profile: ClientProfileV27; result: { ok: boolean; key: string; size: number; error?: string } } => {
  const fresh = makeDefaultClientProfileV27(clientId);
  const result = saveClientProfileV27(fresh);
  return { profile: fresh, result };
};