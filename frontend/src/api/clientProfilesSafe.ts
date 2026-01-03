import { safeFetchJson } from "./safeFetch";

export type ClientProfile = {
  id: string;
  name: string;
  tax_regime?: string;
  employees_count?: number;
  salary_dates?: number[];
  has_vat?: boolean;
  has_tourist_fee?: boolean;
  auto_generate_bank_tasks?: boolean;
};

type ClientProfilesApiResponse =
  | { items: ClientProfile[] }
  | ClientProfile[];

export async function loadClientProfiles(): Promise<ClientProfile[]> {
  const r = await safeFetchJson<ClientProfilesApiResponse>("/api/internal/client-profiles");
  if (!r.ok) return [];

  const data: any = r.data as any;
  const items = Array.isArray(data) ? data : (data?.items ?? []);

  if (!Array.isArray(items)) return [];
  return items
    .filter((x: any) => x && typeof x.id === "string")
    .map((x: any) => ({
      id: String(x.id),
      name: String(x.name ?? x.id),
      tax_regime: x.tax_regime,
      employees_count: x.employees_count,
      salary_dates: x.salary_dates,
      has_vat: x.has_vat,
      has_tourist_fee: x.has_tourist_fee,
      auto_generate_bank_tasks: x.auto_generate_bank_tasks,
    }));
}

/**
 * Backward-compatible alias expected by older imports:
 *   import { fetchClientProfilesSafe } from "./clientProfilesSafe"
 */
export const fetchClientProfilesSafe = loadClientProfiles;