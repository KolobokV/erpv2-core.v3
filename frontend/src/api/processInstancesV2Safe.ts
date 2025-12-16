export type ProcessInstanceV2 = any;

type Resp = {
  items?: any[];
};

function withTrailingSlash(url: string): string {
  const u = String(url || "").trim();
  if (!u) return u;
  if (u.endsWith("/")) return u;
  return u + "/";
}

export async function fetchProcessInstancesV2Safe(): Promise<Resp> {
  const url = withTrailingSlash("/api/internal/process-instances-v2");
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error("process_instances_fetch_failed");
  }
  const data = await res.json();
  return data || {};
}