import type { Location } from "react-router-dom";

function getSearchParam(search: string, key: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    const v = sp.get(key);
    return v ? String(v) : "";
  } catch {
    return "";
  }
}

export function getClientFromLocation(location: Location): string {
  const a = getSearchParam(location.search, "client");
  if (a) return a;
  const b = getSearchParam(location.search, "clientId");
  if (b) return b;
  return "";
}

export function getClientIdFromUrl(): string {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get("client") || u.searchParams.get("clientId") || "";
  } catch {
    return "";
  }
}

export function withClientInUrl(path: string, clientId: string): string {
  if (!clientId) return path;
  try {
    const u = new URL(path, window.location.origin);
    if (!u.searchParams.get("client")) u.searchParams.set("client", clientId);
    return u.pathname + "?" + u.searchParams.toString();
  } catch {
    const hasQ = path.includes("?");
    const sep = hasQ ? "&" : "?";
    return path + sep + "client=" + encodeURIComponent(clientId);
  }
}