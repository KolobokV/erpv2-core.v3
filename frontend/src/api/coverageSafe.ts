export type CoverageSummary = {
  period?: string;
  coverage?: number;
  coveredTasks?: number;
  totalTasks?: number;
  byBucket?: Record<string, number>;
  [k: string]: any;
};

export async function fetchCoverageSummary(period: string, clientId?: string | null, baseUrl: string = ""): Promise<CoverageSummary> {
  const qs = new URLSearchParams({ period });
  if (clientId) qs.set("client_id", clientId);
  const url = `${baseUrl}/api/coverage/summary?${qs.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`coverage_summary_http_${res.status}: ${txt}`);
  }
  return (await res.json()) as CoverageSummary;
}
