type Json = any;

const DEFAULT_CANDIDATES = [
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://host.docker.internal:8000"
];

function pickBaseUrl(): string {
  try {
    const w: any = typeof window !== "undefined" ? window : null;
    const v = w?.localStorage?.getItem("ERP_API_BASE");
    if (v && typeof v === "string" && v.trim().length > 0) return v.trim();
  } catch {
    // ignore
  }
  return DEFAULT_CANDIDATES[0];
}

async function tryFetchJson(url: string, timeoutMs: number): Promise<{ ok: boolean; data?: Json; error?: string }> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: "http_" + res.status };
    const data = await res.json();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: String(e?.name || e?.message || e) };
  } finally {
    window.clearTimeout(t);
  }
}

async function getJson(path: string): Promise<Json> {
  const base = pickBaseUrl();
  const url1 = base + path;

  // 1) First try selected base (default localhost)
  const r1 = await tryFetchJson(url1, 3500);
  if (r1.ok) return r1.data;

  // 2) Fallbacks
  for (const cand of DEFAULT_CANDIDATES) {
    if (cand === base) continue;
    const r = await tryFetchJson(cand + path, 3500);
    if (r.ok) return r.data;
  }

  // 3) Final: return a safe shape to avoid UI crash
  return { ok: false, error: "api_unreachable", detail: r1.error || "timeout", items: [] };
}

export async function fetchTasksAll(): Promise<any[]> {
  const j = await getJson("/api/tasks");
  if (Array.isArray(j)) return j;
  if (j && Array.isArray(j.items)) return j.items;
  return [];
}