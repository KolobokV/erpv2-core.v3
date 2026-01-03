export type InternalControlEvent = {
  id?: string;
  code?: string;
  title?: string;
};

export type InternalControlEventsStoreResponse = {
  items: InternalControlEvent[];
  events: InternalControlEvent[];
};

const EMPTY: InternalControlEventsStoreResponse = { items: [], events: [] };

async function tryFetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const resp = await fetch(path, { credentials: "include" });
    if (!resp.ok) return fallback;
    const data = (await resp.json()) as T;
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

function normalize(raw: any): InternalControlEventsStoreResponse {
  const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
  const events = Array.isArray(raw?.events) ? raw.events : items;
  return { items, events };
}

export async function fetchInternalControlEventsStoreSafe(): Promise<InternalControlEventsStoreResponse> {
  const candidates = [
    "/api/internal/control-events-store-v2/",
    "/api/internal/control-events-store-v2",
    "/api/internal/control-events-store/",
    "/api/internal/control-events-store",
    "/api/internal/internal-control-events-store",
    "/api/internal/internal-control-events-store/",
  ];

  for (const p of candidates) {
    const data = await tryFetchJson<any>(p, null);
    if (data) {
      const norm = normalize(data);
      if (norm.items.length || norm.events.length) return norm;
      // If endpoint exists but empty, still accept.
      if (p.includes("control-events-store")) return norm;
    }
  }

  return EMPTY;
}
