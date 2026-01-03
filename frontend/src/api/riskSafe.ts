export type RiskSummary = {
  totalTasks?: number;
  overdueTasks?: number;
  dueSoonTasks?: number;
  score?: number;
  topReasons?: string[];
  byCategory?: Record<string, number>;
  [k: string]: any;
};

export async function fetchRiskSummary(clientId?: string | null, baseUrl: string = ""): Promise<RiskSummary> {
  const qs = new URLSearchParams();
  if (clientId) qs.set("client_id", clientId);
  const url = `${baseUrl}/api/risk/summary${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`risk_summary_http_${res.status}: ${txt}`);
  }
  return (await res.json()) as RiskSummary;
}
