import { safeFetchJson } from "./safeFetch";

export type InternalControlEvent = {
  id: string;
  code: string;
  title: string;
};

export type InternalControlEventsStoreResponse = {
  events: InternalControlEvent[];
};

const EMPTY: InternalControlEventsStoreResponse = {
  events: [],
};

export async function fetchInternalControlEventsStoreSafe() {
  return safeFetchJson<InternalControlEventsStoreResponse>(
    "/api/internal/internal-control-events-store",
    EMPTY
  );
}