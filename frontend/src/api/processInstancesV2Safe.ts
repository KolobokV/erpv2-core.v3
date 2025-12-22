// SAFE MODE PATCHED: suppress console noise on HTTP 500
export type SafeApiResult<T> = {
  ok: boolean;
  items?: T[];
  error?: string;
};

export async function fetchProcessInstancesV2Safe(): Promise<SafeApiResult<any>> {
  try {
    const resp = await fetch("/api/internal/process-instances-v2/");
    if (!resp.ok) {
      // quiet failure
      return { ok: false, items: [], error: "HTTP " + resp.status };
    }
    const text = await resp.text();
    if (!text) return { ok: true, items: [] };
    const data = JSON.parse(text);
    return { ok: true, items: Array.isArray(data?.items) ? data.items : [] };
  } catch {
    // suppress network/json errors
    return { ok: false, items: [], error: "network" };
  }
}
