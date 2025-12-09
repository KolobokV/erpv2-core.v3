import React, { useEffect, useState } from "react";

type ClientInfo = {
  client_id?: string;
  id?: string;
  label?: string;
  name?: string;
  [key: string]: any;
};

type InstanceInfo = {
  id?: string;
  client_id?: string;
  profile_id?: string;
  period?: string;
  year?: number;
  month?: number;
  status?: string;
  [key: string]: any;
};

type InstancesResponse =
  | {
      clients?: ClientInfo[];
      instances?: InstanceInfo[];
      items?: InstanceInfo[];
      [key: string]: any;
    }
  | InstanceInfo[]
  | null
  | undefined;

type CoverageRow = {
  client_id: string;
  label: string;
  total: number;
  completed: number;
  in_progress: number;
  error: number;
};

function toClientsAndInstances(data: InstancesResponse): {
  clients: ClientInfo[];
  instances: InstanceInfo[];
} {
  if (!data) return { clients: [], instances: [] };

  if (Array.isArray(data)) {
    return { clients: [], instances: data };
  }

  const clients: ClientInfo[] = Array.isArray(data.clients) ? data.clients : [];
  let instances: InstanceInfo[] = [];

  if (Array.isArray(data.instances)) {
    instances = data.instances;
  } else if (Array.isArray((data as any).items)) {
    instances = (data as any).items as InstanceInfo[];
  }

  return { clients, instances };
}

function buildCoverage(clients: ClientInfo[], instances: InstanceInfo[]): CoverageRow[] {
  const byClientLabel = new Map<string, string>();

  for (const c of clients) {
    const id = (c.client_id || c.id || "").toString();
    if (!id) continue;
    const label = (c.label || c.name || id).toString();
    byClientLabel.set(id, label);
  }

  const map = new Map<string, CoverageRow>();

  for (const inst of instances) {
    const clientId = (inst.client_id || "").toString();
    if (!clientId) continue;

    const label = byClientLabel.get(clientId) || clientId;
    let row = map.get(clientId);
    if (!row) {
      row = {
        client_id: clientId,
        label,
        total: 0,
        completed: 0,
        in_progress: 0,
        error: 0,
      };
      map.set(clientId, row);
    }

    row.total += 1;
    const status = (inst.status || "").toString().toLowerCase();

    if (status === "completed" || status === "done") {
      row.completed += 1;
    } else if (status === "error" || status === "failed") {
      row.error += 1;
    } else if (status) {
      row.in_progress += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const ProcessCoveragePage: React.FC = () => {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch("/api/internal/process-instances-v2/");
        if (!resp.ok) {
          throw new Error("Failed to load process instances v2: " + resp.status);
        }
        const json: InstancesResponse = await resp.json();
        if (!mounted) return;
        const { clients: cList, instances: iList } = toClientsAndInstances(json);
        setClients(cList);
        setInstances(iList);
        const cov = buildCoverage(cList, iList);
        setCoverage(cov);
        if (cov.length > 0) {
          setSelectedClientId(cov[0].client_id);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedInstances = instances.filter(
    (inst) => selectedClientId && inst.client_id === selectedClientId
  );

  const selectedClientLabel =
    coverage.find((c) => c.client_id === selectedClientId)?.label || selectedClientId || "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Process coverage</h1>
        <p className="text-sm text-slate-700">
          Coverage by client based on /api/internal/process-instances-v2/.
        </p>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          Loading process instances...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && coverage.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          No instances found. Use internal processes tools to create process instances.
        </div>
      )}

      {coverage.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coverage by client */}
          <div className="rounded-md border border-slate-200 bg-white text-xs">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Clients coverage ({coverage.length})
              </span>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Completed</th>
                    <th className="px-3 py-2 text-right">In progress</th>
                    <th className="px-3 py-2 text-right">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((row) => {
                    const isSelected = row.client_id === selectedClientId;
                    return (
                      <tr
                        key={row.client_id}
                        className={
                          "cursor-pointer border-t border-slate-100 " +
                          (isSelected ? "bg-emerald-50" : "hover:bg-slate-50")
                        }
                        onClick={() => setSelectedClientId(row.client_id)}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800 truncate max-w-[220px]" title={row.label}>
                            {row.label}
                          </div>
                          <div className="text-[10px] text-slate-500">{row.client_id}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-800">
                          {row.total}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {row.completed}
                        </td>
                        <td className="px-3 py-2 text-right text-sky-700">
                          {row.in_progress}
                        </td>
                        <td className="px-3 py-2 text-right text-red-700">
                          {row.error}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Instances for selected client */}
          <div className="rounded-md border border-slate-200 bg-white text-xs">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Instances for client
              </span>
              {selectedClientId && (
                <span className="text-[11px] text-slate-600 font-mono">
                  {selectedClientLabel} ({selectedClientId})
                </span>
              )}
            </div>
            <div className="max-h-[520px] overflow-auto">
              {selectedInstances.length === 0 ? (
                <div className="px-3 py-2 text-slate-700">
                  No instances for selected client.
                </div>
              ) : (
                <table className="min-w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Profile</th>
                      <th className="px-3 py-2">Id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInstances.map((inst, idx) => {
                      const period =
                        inst.period ||
                        (inst.year && inst.month
                          ? `${inst.year}-${String(inst.month).padStart(2, "0")}`
                          : "-");
                      const status = inst.status || "-";
                      const profile = inst.profile_id || "-";
                      return (
                        <tr key={inst.id || idx} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">{period}</td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                (status === "completed" || status === "done"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : status === "error" || status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-slate-100 text-slate-700")
                              }
                            >
                              {status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{profile}</td>
                          <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">
                            {inst.id || idx}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessCoveragePage;
