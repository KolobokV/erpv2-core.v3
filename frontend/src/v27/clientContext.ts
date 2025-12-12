import { Location } from "react-router-dom";

export const getClientFromSearch = (search: string): string | null => {
  const sp = new URLSearchParams(search || "");
  const v = sp.get("client");
  if (!v) return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t;
};

export const setClientInSearch = (search: string, clientId: string | null): string => {
  const sp = new URLSearchParams(search || "");
  if (!clientId) sp.delete("client");
  else sp.set("client", clientId);
  const out = sp.toString();
  return out.length ? "?" + out : "";
};

export const getClientFromLocation = (loc: Location): string | null => {
  return getClientFromSearch(loc.search || "");
};