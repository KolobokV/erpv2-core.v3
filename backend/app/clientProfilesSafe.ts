import { safeFetchJson } from "./safeFetch";

export type ClientProfile = {
  client_key?: string;
  label?: string;
  tax_mode?: string;
};

export type ClientProfilesResponse = {
  items: ClientProfile[];
};

const EMPTY: ClientProfilesResponse = { items: [] };

export async function fetchClientProfilesSafe() {
  return safeFetchJson<ClientProfilesResponse>(
    "/api/internal/client-profiles",
    EMPTY
  );
}