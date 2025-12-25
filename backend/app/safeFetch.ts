export type SafeResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

export async function safeJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeResult<T>> {
  try {
    const resp = await fetch(url, options);
    const status = resp.status;
    const text = await resp.text();

    if (!resp.ok) {
      return { ok: false, status, data: null, error: text || `HTTP ${status}` };
    }

    if (!text) {
      return { ok: true, status, data: null };
    }

    try {
      return { ok: true, status, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status, data: null, error: "Invalid JSON response" };
    }
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: e?.message || "Network error" };
  }
}
