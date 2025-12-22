import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* =======================
   Types
======================= */

type InstanceInfo = {
  instance_key?: string;
  client_code?: string;
  client_id?: string;
  client_label?: string;
  profile_id?: string;
  period?: string;
  status?: string;
  [key: string]: any;
};

type InstancesResponse =
  | InstanceInfo[]
  | { items?: InstanceInfo[]; instances?: InstanceInfo[] }
  | null
  | undefined;

type ClientCoverageRow = {
  clientKey: string;
  clientLabel: string;
  total: number;
  completed: number;
  inProgress: number;
  error: number;
  completionRate: number;
  lastPeriod: string;
};

/* =======================
   Helpers
======================= */

function getClientFromSearch(search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    return (sp.get("client") || "").trim();
  } catch {
    return "";
  }
}

function clearClientFromUrl(pathname: string, search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    if (!sp.has("client")) return pathname + (search || "");
    sp.delete("client");
    const next = sp.toString();
    return pathname + (next ? "?" + next : "");
  } catch {
    return pathname;
  }
}

function toInstances(data: InstancesResponse): InstanceInfo[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items;
  if (Array.isArray((data as any).instances)) return (data as any).instances;
  return [];
}

function clientKey(inst: InstanceInfo): string {
  return String(inst.client_code || inst.client_id || inst.client_label || "").trim();
}

function clientLabel(inst: InstanceInfo): string {
  return inst.client_label || inst.client_code || inst.client_id || "-";
}

function statusKey(status?: string): string {
  return (status || "").toLowerCase();
}

function buildCoverage(instances: InstanceInfo[]): ClientCoverageRow[] {
  const map = new Map<string, ClientCoverageRow>();

  for (const inst of instances) {
    const key = clientKey(inst);
    if (!key) continue;

    let row = map.get(key);
    if (!row) {
      row = {
        clientKey: key,
        clientLabel: clientLabel(inst),
        total: 0,
        completed: 0,
        inProgress: 0,
        error: 0,
        completionRate: 0,
        lastPeriod: "",
      };
      map.set(key, row);
    }

    row.total += 1;
    const st = statusKey(inst.status);
    if (st === "completed" || st === "done") row.completed += 1;
    else if (st === "error" || st === "failed") row.error += 1;
    else row.inProgress += 1;

    if (inst.period && inst.period > row.lastPeriod) {
      row.lastPeriod = inst.period;
    }
  }

  const rows = Array.from(map.values());
  rows.forEach((r) => {
    r.completionRate = r.total ? Math.round((r.completed / r.total) * 100) : 0;
  });

  rows.sort((a, b) => a.clientLabel.localeCompare(b.clientLabel));
  return rows;
}

/* =======================
   Component
======================= */

const ProcessCoveragePage: React.FC = () => {
  const loc = useLocation();
  const nav = useNavigate();
  const clientFromUrl = getClientFromSearch(loc.search);

  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch("/api/internal/process-instances-v2/")
      .then(async (r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      const t = await r.text();
      if (!t) return null;
      return JSON.parse(t);
    })
      .then((j) => {
        if (!mounted) return;
        setInstances(toInstances(j));
      })
      .catch((e) => mounted && setError(e?.message || "Load error"))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const coverageRows = useMemo(() => buildCoverage(instances), [instances]);

  useEffect(() => {
    if (clientFromUrl) {
      setSelectedClientKey(clientFromUrl);
    }
  }, [clientFromUrl]);

  const selectedInstances = useMemo(() => {
    if (!selectedClientKey) return [];
    return instances
      .filter((i) => clientKey(i) === selectedClientKey)
      .sort((a, b) => (a.period || "").localeCompare(b.period || "") * -1);
  }, [instances, selectedClientKey]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Process coverage</h1>

        {clientFromUrl && (
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs ring-1 ring-slate-200">
            <span className="text-slate-500">client</span>
            <span className="font-medium">{clientFromUrl}</span>
            <button
              type="button"
              className="rounded-full px-1 text-[11px] hover:bg-slate-100"
              onClick={() => nav(clearClientFromUrl(loc.pathname, loc.search))}
            >
              x
            </button>
          </div>
        )}
      </div>

      {loading && <div className="text-sm text-slate-600">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && coverageRows.length === 0 && (
        <div className="text-sm text-slate-600">No data</div>
      )}

      {coverageRows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">Clients</div>
            {coverageRows.map((r) => (
              <button
                key={r.clientKey}
                onClick={() => setSelectedClientKey(r.clientKey)}
                className={
                  "block w-full rounded px-2 py-1 text-left hover:bg-slate-50 " +
                  (r.clientKey === selectedClientKey ? "bg-sky-50" : "")
                }
              >
                <div className="font-medium">{r.clientLabel}</div>
                <div className="text-[11px] text-slate-500">
                  {r.completed}/{r.total} Р’В· {r.completionRate}%
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border bg-white p-3 text-xs">
            <div className="mb-2 font-semibold">Client instances</div>
            {selectedInstances.length === 0 && (
              <div className="text-slate-500">Select a client</div>
            )}
            {selectedInstances.map((i, idx) => (
              <div key={idx} className="border-b border-slate-100 py-1">
                <div className="font-medium">{i.period}</div>
                <div className="text-[11px] text-slate-500">
                  status: {i.status || "-"} Р’В· profile: {i.profile_id || "-"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessCoveragePage;