export type DefinitionItem = {
  key: string;
  label: string;
};

export type DefinitionsResponse = {
  items: DefinitionItem[];
};

const EMPTY: DefinitionsResponse = { items: [] };

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

export async function fetchDefinitionsSafe(): Promise<DefinitionsResponse> {
  const candidates = [
    "/api/internal/definitions",
    "/api/internal/definitions/",
    "/api/internal/definitions-v2",
    "/api/internal/definitions-v2/",
  ];

  for (const p of candidates) {
    const data = await tryFetchJson<any>(p, null);
    if (data && Array.isArray(data.items)) {
      return { items: data.items as DefinitionItem[] };
    }
    if (Array.isArray(data)) {
      return { items: data as DefinitionItem[] };
    }
  }

  return EMPTY;
}
