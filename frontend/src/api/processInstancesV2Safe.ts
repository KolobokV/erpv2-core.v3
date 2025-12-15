import { safeFetchJson } from "./safeFetch";

export type ProcessInstanceV2 = {
  instance_id?: string;
  client_key?: string;
  profile_key?: string;
  period?: string;
  status?: string;
};

export type ProcessInstancesV2Response = {
  items: ProcessInstanceV2[];
};

const EMPTY: ProcessInstancesV2Response = { items: [] };

export async function fetchProcessInstancesV2Safe() {
  return safeFetchJson<ProcessInstancesV2Response>(
    "/api/internal/process-instances-v2",
    EMPTY
  );
}