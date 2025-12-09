import React, { useEffect, useState } from "react";

type ClientInfo = {
  client_code?: string;
  label?: string;
  name?: string;
  [key: string]: any;
};

type InstanceInfo = {
  instance_key?: string;
  client_code?: string;
  client_label?: string;
  profile_id?: string;
  period?: string;
  year?: number;
  month?: number;
  status?: string;
  [key: string]: any;
};

function buildCoverage(instances: InstanceInfo[]): any[] {
  const map = new Map<string, any>();

  for (const inst of instances) {
    const cid = inst.client_code;
    if (!cid) continue;
    const label = inst.client_label || cid;

    let row = map.get(cid);
    if (!row) {
      row = {
        client_id: cid,
        label,
        total: 0,
        completed: 0,
        in_progress: 0,
        error: 0,
      };
      map.set(cid, row);
    }

    row.total += 1;
    const st = (inst.status || "").toLowerCase();
    if (st === "completed" || st === "done") row.completed++;
    else if (st === "error" || st === "failed") row.error++;
    else row.in_progress++;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

const ProcessCoveragePage: React.FC = () => {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/internal/process-instances-v2/");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json = await r.json();
        if (!mounted) return;

        const list = Array.isArray(json) ? json : json.items || json.instances || [];
        setInstances(list);

        const cov = buildCoverage(list);
        setCoverage(cov);

        if (cov.length > 0) setSelectedClientId(cov[0].client_id);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const selectedInstances = instances.filter(
    (i) => selectedClientId && i.client_code === selectedClientId
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold mb-1">Process coverage</h1>

      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}

      {!loading && !error && coverage.length === 0 && (
        <div>No instances found.</div>
      )}

      {coverage.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="border rounded-md bg-white text-xs">
            <div className="border-b px-3 py-2 font-medium">Clients coverage</div>
            <table className="min-w-full">
              <tbody>
                {coverage.map((row) => (
                  <tr
                    key={row.client_id}
                    onClick={() => setSelectedClientId(row.client_id)}
                    className="border-t hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div>{row.label}</div>
                      <div className="text-[10px] text-slate-500">{row.client_id}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{row.total}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{row.completed}</td>
                    <td className="px-3 py-2 text-right text-sky-700">{row.in_progress}</td>
                    <td className="px-3 py-2 text-right text-red-700">{row.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border rounded-md bg-white text-xs">
            <div className="border-b px-3 py-2 font-medium">Instances</div>
            <table className="min-w-full">
              <tbody>
                {selectedInstances.map((inst, idx) => (
                  <tr key={inst.instance_key || idx} className="border-t">
                    <td className="px-3 py-2">{inst.period}</td>
                    <td className="px-3 py-2">{inst.status}</td>
                    <td className="px-3 py-2">{inst.profile_id}</td>
                    <td className="px-3 py-2 text-[10px] font-mono">
                      {inst.instance_key || idx}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default ProcessCoveragePage;
