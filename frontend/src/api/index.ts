export type HttpError = {
  status: number;
  message: string;
};

async function httpJson<T>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const resp = await fetch(path, init);
  const text = await resp.text();

  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!resp.ok) {
    const msg =
      (data && (data.detail || data.message)) ? JSON.stringify(data.detail || data.message)
      : (resp.statusText || "Request failed");
    const err: HttpError = { status: resp.status, message: msg };
    throw err;
  }

  return data as T;
}

export function apiGetJson<T>(path: string): Promise<T> {
  return httpJson<T>("GET", path);
}

export function apiPostJson<T>(path: string, body: any): Promise<T> {
  return httpJson<T>("POST", path, body);
}

export function apiPutJson<T>(path: string, body: any): Promise<T> {
  return httpJson<T>("PUT", path, body);
}

export function apiDeleteJson<T>(path: string): Promise<T> {
  return httpJson<T>("DELETE", path);
}