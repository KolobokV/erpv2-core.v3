export type InternalAliasItem = {
  key: string;
  value: string;
};

export type InternalAliasesResponse = {
  items: InternalAliasItem[];
};

const EMPTY: InternalAliasesResponse = { items: [] };

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

export async function fetchInternalAliasesSafe(): Promise<InternalAliasesResponse> {
  const candidates = [
    "/api/internal/aliases",
    "/api/internal/aliases/",
    "/api/internal/internal-aliases",
    "/api/internal/internal-aliases/",
    "/api/internal/aliases-v2",
    "/api/internal/aliases-v2/",
  ];

  for (const p of candidates) {
    const data = await tryFetchJson<any>(p, null);
    if (data && Array.isArray(data.items)) {
      return { items: data.items as InternalAliasItem[] };
    }
    if (Array.isArray(data)) {
      return { items: data as InternalAliasItem[] };
    }
  }

  return EMPTY;
}
