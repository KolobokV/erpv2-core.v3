export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:8000";

export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : "/" + path;
  return base + p;
}

async function readJsonSafe(resp: Response): Promise<any> {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function apiGetJson(path: string, init?: RequestInit): Promise<any> {
  const url = apiUrl(path);
  const resp = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!resp.ok) {
    const body = await readJsonSafe(resp);
    const msg = `GET ${url} failed: ${resp.status} ${resp.statusText}`;
    const err: any = new Error(msg);
    err.status = resp.status;
    err.body = body;
    throw err;
  }

  return await readJsonSafe(resp);
}
