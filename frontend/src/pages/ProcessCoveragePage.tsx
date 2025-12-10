import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

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

type InstancesResponse =
  | InstanceInfo[]
  | {
      items?: InstanceInfo[];
      instances?: InstanceInfo[];
      [key: string]: any;
    }
  | null
  | undefined;

type ClientCoverageRow = {
  clientId: string;
  clientLabel: string;
  total: number;
  completed: number;
  inProgress: number;
  error: number;
  completionRate: number;
  lastPeriod: string;
};

function useQuery(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

function toInstances(data: InstancesResponse): InstanceInfo[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as InstanceInfo[];
  if (Array.isArray((data as any).instances)) {
    return (data as any).instances as InstanceInfo[];
  }
  return [];
}

function getStatusKey(status?: string): string {
  return (status || "").toLowerCase();
}

function getStatusBadgeClasses(status?: string): string {
  const s = getStatusKey(status);
  if (s === "completed" || s === "done") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (s === "error" || s === "failed") {
    return "bg-red-50 text-red-800 border-red-200";
  }
  if (s === "in_progress" || s === "in-progress" || s === "running") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (s === "new" || s === "planned" || s === "created") {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getStatusLabel(status?: string): string {
  const s = getStatusKey(status);
  if (!s) return "-";
  if (s === "in_progress" || s === "in-progress") return "in progress";
  return s;
}

function buildCoverage(instances: InstanceInfo[]): ClientCoverageRow[] {
  const map = new Map<string, ClientCoverageRow>();

  for (const inst of instances) {
    const clientId = inst.client_code;
    if (!clientId) continue;
    const label = inst.client_label || clientId;

    let row = map.get(clientId);
    if (!row) {
      row = {
        clientId,
        clientLabel: label,
        total: 0,
        completed: 0,
        inProgress: 0,
        error: 0,
        completionRate: 0,
        lastPeriod: "",
      };
      map.set(clientId, row);
    }

    row.total += 1;
    const st = getStatusKey(inst.status);
    if (st === "completed" || st === "done") {
      row.completed += 1;
    } else if (st === "error" || st === "failed") {
      row.error += 1;
    } else {
      row.inProgress += 1;
    }

    const period = inst.period || "";
    if (!row.lastPeriod || period > row.lastPeriod) {
      row.lastPeriod = period;
    }
  }

  const rows = Array.from(map.values());
  for (const row of rows) {
    row.completionRate =
      row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
  }

  rows.sort((a, b) => {
    if (a.completionRate !== b.completionRate) {
      return a.completionRate - b.completionRate;
    }
    return a.clientLabel.localeCompare(b.clientLabel);
  });

  return rows;
}

const ProcessCoveragePage: React.FC = () => {
  const query = useQuery();
  const clientFromQuery = query.get("client_code") || "";

  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch("/api/internal/process-instances-v2/");
        if (!resp.ok) {
          throw new Error("Failed to load instances: " + resp.status);
        }
        const json: InstancesResponse = await resp.json();
        if (!mounted) return;
        const list = toInstances(json);
        setInstances(list);
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Unknown error");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const coverageRows = useMemo(() => {
    const base = buildCoverage(instances);
    const filtered = base.filter((row) => {
      if (clientFilter) {
        const text =
          (row.clientLabel + " " + row.clientId).toLowerCase();
        if (!text.includes(clientFilter.toLowerCase())) {
          return false;
        }
      }
      if (statusFilter === "problems") {
        return row.error > 0 || row.completionRate < 100;
      }
      if (statusFilter === "ok") {
        return row.error === 0 && row.completionRate === 100;
      }
      return true;
    });
    return filtered;
  }, [instances, clientFilter, statusFilter]);

  useEffect(() => {
    if (clientFromQuery) {
      setSelectedClientId(clientFromQuery);
      setClientFilter(clientFromQuery);
    }
  }, [clientFromQuery]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return coverageRows.find((r) => r.clientId === selectedClientId) || null;
  }, [selectedClientId, coverageRows]);

  useEffect(() => {
    if (!selectedClientId && coverageRows.length > 0) {
      setSelectedClientId(coverageRows[0].clientId);
    }
  }, [selectedClientId, coverageRows]);

  const selectedInstances = useMemo(() => {
    if (!selectedClientId) return [];
    const list = instances.filter(
      (inst) => inst.client_code === selectedClientId
    );
    list.sort((a, b) => {
      const pa = a.period || "";
      const pb = b.period || "";
      if (pa < pb) return 1;
      if (pa > pb) return -1;
      return 0;
    });
    return list;
  }, [instances, selectedClientId]);

  const stats = useMemo(() => {
    const totalInstances = instances.length;
    const clientsCount = buildCoverage(instances).length;
    let completed = 0;
    let errors = 0;
    for (const inst of instances) {
      const st = getStatusKey(inst.status);
      if (st === "completed" || st === "done") completed += 1;
      if (st === "error" || st === "failed") errors += 1;
    }
    const completionRate =
      totalInstances > 0
        ? Math.round((completed / totalInstances) * 100)
        : 0;
    return { totalInstances, clientsCount, completed, errors, completionRate };
  }, [instances]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Process coverage
          </h1>
          <p className="text-sm text-slate-600">
            Coverage of process instances by client based on /api/internal/process-instances-v2/. Supports client_code in query string.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex flex-col">
            <label className="text-[11px] font-medium text-slate-600">
              Client filter
            </label>
            <input
              className="mt-1 rounded-md border border-slate-300 px-2 py-1"
              placeholder="Search by client code or label..."
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-medium text-slate-600">
              Coverage filter
            </label>
            <select
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="problems">Only problematic</option>
              <option value="ok">Fully covered</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm md:col-span-1">
          <div className="text-slate-500">Total instances</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.totalInstances}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm md:col-span-1">
          <div className="text-slate-500">Clients</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.clientsCount}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs shadow-sm md:col-span-1">
          <div className="text-emerald-700">Completed instances</div>
          <div className="mt-1 text-lg font-semibold text-emerald-900">
            {stats.completed}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs shadow-sm md:col-span-1">
          <div className="text-red-700">Errors</div>
          <div className="mt-1 text-lg font-semibold text-red-900">
            {stats.errors}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm md:col-span-1">
          <div className="text-slate-500">Completion rate</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.completionRate}%
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading process instances...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && coverageRows.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No coverage data for current filters.
        </div>
      )}

      {coverageRows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left: clients coverage list */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Clients coverage
              </h2>
              <span className="text-[11px] text-slate-500">
                {coverageRows.length} clients
              </span>
            </div>
            <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="border-b border-slate-100 px-2 py-2 text-left font-medium">
                      Client
                    </th>
                    <th className="border-b border-slate-100 px-2 py-2 text-right font-medium w-[60px]">
                      Total
                    </th>
                    <th className="border-b border-slate-100 px-2 py-2 text-right font-medium w-[60px]">
                      Done
                    </th>
                    <th className="border-b border-slate-100 px-2 py-2 text-right font-medium w-[60px]">
                      In progress
                    </th>
                    <th className="border-b border-slate-100 px-2 py-2 text-right font-medium w-[60px]">
                      Error
                    </th>
                    <th className="border-b border-slate-100 px-2 py-2 text-right font-medium w-[70px]">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coverageRows.map((row) => {
                    const isSelected = row.clientId === selectedClientId;
                    const rowClasses = isSelected
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-900";
                    const secondaryText =
                      "text-[10px] " +
                      (isSelected ? "text-slate-200" : "text-slate-500");

                    return (
                      <tr
                        key={row.clientId}
                        className={
                          "cursor-pointer border-b border-slate-100 hover:bg-slate-100 " +
                          (isSelected ? "hover:bg-slate-800" : "")
                        }
                        onClick={() => setSelectedClientId(row.clientId)}
                      >
                        <td className={"px-2 py-1.5 align-middle " + rowClasses}>
                          <div className="truncate font-medium">
                            {row.clientLabel}
                          </div>
                          <div className={secondaryText}>{row.clientId}</div>
                          {row.lastPeriod && (
                            <div className={secondaryText}>
                              last period: {row.lastPeriod}
                            </div>
                          )}
                        </td>
                        <td
                          className={
                            "px-2 py-1.5 text-right align-middle " + rowClasses
                          }
                        >
                          {row.total}
                        </td>
                        <td
                          className={
                            "px-2 py-1.5 text-right align-middle " +
                            rowClasses
                          }
                        >
                          {row.completed}
                        </td>
                        <td
                          className={
                            "px-2 py-1.5 text-right align-middle " +
                            rowClasses
                          }
                        >
                          {row.inProgress}
                        </td>
                        <td
                          className={
                            "px-2 py-1.5 text-right align-middle " +
                            rowClasses
                          }
                        >
                          {row.error}
                        </td>
                        <td
                          className={
                            "px-2 py-1.5 text-right align-middle " +
                            rowClasses
                          }
                        >
                          {row.completionRate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: selected client instances */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Client instances
                </h2>
                {selectedClient && (
                  <div className="text-[11px] text-slate-500">
                    {selectedClient.clientLabel} · {selectedClient.clientId}
                  </div>
                )}
              </div>
              {selectedInstances.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {selectedInstances.length} instances
                </span>
              )}
            </div>

            {(!selectedClientId || selectedInstances.length === 0) && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Select a client from the left list to see instance details.
              </div>
            )}

            {selectedInstances.length > 0 && (
              <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100">
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[90px]">
                        Period
                      </th>
                      <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[100px]">
                        Status
                      </th>
                      <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[120px]">
                        Profile
                      </th>
                      <th className="border-b border-slate-100 px-2 py-2 text-left font-medium">
                        Instance key
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInstances.map((inst, index) => {
                      const status = inst.status || "-";
                      const statusLabel = getStatusLabel(status);
                      const statusClasses = getStatusBadgeClasses(status);
                      const rowStripe =
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                      return (
                        <tr key={inst.instance_key || index} className={rowStripe}>
                          <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                            {inst.period || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                            <span
                              className={
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                                statusClasses
                              }
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                            {inst.profile_id || "-"}
                          </td>
                          <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                            <div className="truncate font-mono text-[11px]">
                              {inst.instance_key || "-"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessCoveragePage;
