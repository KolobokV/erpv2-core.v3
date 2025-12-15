export type SafeFetchMetaState = "ok" | "missing" | "error";

export type SafeFetchResult<T> = {
  ok: boolean;
  status: number;
  data: T;
  meta: {
    state: SafeFetchMetaState;
  };
};

export async function safeFetchJson<T>(
  url: string,
  fallback: T
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url);

    if (res.status === 404) {
      return { ok: false, status: 404, data: fallback, meta: { state: "missing" } };
    }

    if (!res.ok) {
      return { ok: false, status: res.status, data: fallback, meta: { state: "error" } };
    }

    const json = (await res.json()) as T;
    return { ok: true, status: res.status, data: json, meta: { state: "ok" } };
  } catch {
    return { ok: false, status: 0, data: fallback, meta: { state: "error" } };
  }
}