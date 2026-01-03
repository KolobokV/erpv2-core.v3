export type SafeFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

async function readJsonSafe<T>(resp: Response): Promise<T | null> {
  try {
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export async function safeFetchJson<T>(
  path: string,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const resp = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });

    const data = await readJsonSafe<T>(resp);

    if (resp.ok) {
      return { ok: true, status: resp.status, data: (data as T) };
    }

    const errText =
      (data as any)?.detail
        ? JSON.stringify((data as any).detail)
        : resp.statusText || "Request failed";

    return { ok: false, status: resp.status, error: errText };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message ?? "Network error" };
  }
}