import { safeFetchJson } from "./safeFetch";

export type DefinitionItem = {
  key: string;
  label: string;
};

export type DefinitionsResponse = {
  items: DefinitionItem[];
};

const EMPTY: DefinitionsResponse = {
  items: [],
};

export async function fetchDefinitionsSafe() {
  return safeFetchJson<DefinitionsResponse>(
    "/api/internal/definitions",
    EMPTY
  );
}