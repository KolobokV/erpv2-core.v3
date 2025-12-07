import React, { useEffect, useMemo, useState } from "react";

type InstanceStep = {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  completed_at?: string;
};

type ProcessInstance = {
  id: string;
  client_id?: string;
  profile_code?: string;
  period?: string;
  key?: string;
  status?: string;
  computed_status?: string;
  source?: string;
  events?: string[];
  last_event_code?: string;
  steps?: InstanceStep[];
  created_at?: string;
  updated_at?: string;
};

type FetchState<T> = {
  loading: boolean;
  error: string | null;
  items: T[];
};

type StatusCounters = {
  total: number;
  open: number;
  waiting: number;
  completed: number;
  error: number;
  other: number;
};

function getInstanceDisplayStatus(inst: ProcessInstance): string {
  if (inst.computed_status && inst.computed_status.trim().length > 0) {
    return inst.computed_status;
  }
  if (inst.status && inst.status.trim().length > 0) {
    return inst.status;
  }
  return "open";
}

function getStatusPillClasses(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return "border border-green-200 bg-green-50 text-green-800";
  }
  if (normalized === "waiting") {
    return "border border-amber-200 bg-amber-50 text-amber-800";
  }
  if (normalized === "error" || normalized === "failed") {
    return "border border-red-200 bg-red-50 text-red-800";
  }
  return "border border-blue-200 bg-blue-50 text-blue-800";
}

function getStepPillClasses(status: string): string {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed") {
    return "border border-green-200 bg-green-50 text-green-800";
  }
  if (normalized === "error" || normalized === "failed") {
    return "border border-red-200 bg-red-50 text-red-800";
  }
  return "border border-slate-200 bg-slate-50 text-slate-700";
}

const InternalProcessesPage: React.FC = () => {
  const [state, setState] = useState<FetchState<ProcessInstance>>({
    loading: false,
    error: null,
    items: [],
  });

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null
  );

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("");

  const loadInstances = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch("/api/internal/process-instances");
      if (!res.ok) {
        throw new Error(`Failed to load process instances, status ${res.status}`);
      }

      const json = await res.json();
      const items: ProcessInstance[] = Array.isArray(json)
        ? json
        : json.items ?? [];

      setState({ loading: false, error: null, items });
      if (items.length > 0) {
        setSelectedInstanceId(items[0].id);
      } else {
        setSelectedInstanceId(null);
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || "Failed to load process instances",
      }));
    }
  };

  useEffect(() => {
    loadInstances().catch(() => undefined);
  }, []);

  const { loading, error, items } = state;

  const filteredInstances = useMemo(() => {
    let list = items;

    const cf = clientFilter.trim().toLowerCase();
    if (cf) {
      list = list.filter((inst) =>
        (inst.client_id || "").toLowerCase().includes(cf)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((inst) => {
        const displayStatus = getInstanceDisplayStatus(inst).toLowerCase();
        return displayStatus === statusFilter;
      });
    }

    const copy = [...list];
    copy.sort((a, b) => {
      const aKey =
        (a.client_id || "") +
        "|" +
        (a.profile_code || "") +
        "|" +
        (a.period || "") +
        "|" +
        a.id;
      const bKey =
        (b.client_id || "") +
        "|" +
        (b.profile_code || "") +
        "|" +
        (b.period || "") +
        "|" +
        b.id;
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return 0;
    });
    return copy;
  }, [items, clientFilter, statusFilter]);

  const statusCounters: StatusCounters = useMemo(() => {
    const counters: StatusCounters = {
      total: items.length,
      open: 0,
      waiting: 0,
      completed: 0,
      error: 0,
      other: 0,
    };

    for (const inst of items) {
      const s = getInstanceDisplayStatus(inst).toLowerCase();
      if (s === "open") counters.open += 1;
      else if (s === "waiting") counters.waiting += 1;
      else if (s === "completed") counters.completed += 1;
      else if (s === "error" || s === "failed") counters.error += 1;
      else counters.other += 1;
    }

    return counters;
  }, [items]);

  const selectedInstance: ProcessInstance | undefined = useMemo(() => {
    if (!selectedInstanceId) return undefined;
    return items.find((inst) => inst.id === selectedInstanceId);
  }, [selectedInstanceId, items]);

  const steps: InstanceStep[] = selectedInstance?.steps ?? [];

  return (
    <div className="flex h-full flex-col p-4">
      <header className="mb-3 border-b border-gray-200 pb-2">
        <h1 className="text-base font-semibold text-gray-900">
          Internal processes
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Process instances built from control events and stored in JSON backend
          store. This view shows instances on the left and steps of the selected
          instance on the right.
        </p>
      </header>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <section className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-700">
            Client filter
          </label>
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            placeholder="client_id (optional)"
            className="h-8 w-48 rounded border border-gray-300 px-2 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-700">
            Status filter
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 w-40 rounded border border-gray-300 px-2 text-xs"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="waiting">Waiting</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadInstances}
          disabled={loading}
          className="inline-flex h-8 items-center rounded border border-gray-300 bg-white px-3 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Reload"}
        </button>

        <div className="ml-auto flex flex-col items-end gap-0.5 text-[11px] text-gray-600">
          <div>
            Total instances:{" "}
            <span className="font-mono text-gray-900">
              {statusCounters.total}
            </span>
          </div>
          <div className="flex gap-3">
            <span>
              Open:{" "}
              <span className="font-mono text-gray-900">
                {statusCounters.open}
              </span>
            </span>
            <span>
              Waiting:{" "}
              <span className="font-mono text-gray-900">
                {statusCounters.waiting}
              </span>
            </span>
            <span>
              Completed:{" "}
              <span className="font-mono text-gray-900">
                {statusCounters.completed}
              </span>
            </span>
            <span>
              Error:{" "}
              <span className="font-mono text-gray-900">
                {statusCounters.error}
              </span>
            </span>
          </div>
          {statusCounters.other > 0 && (
            <div className="text-[10px] text-gray-400">
              Other statuses: {statusCounters.other}
            </div>
          )}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)] gap-3">
        {/* Left: process instances */}
        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Process instances
            </h2>
            <span className="text-[11px] text-gray-500">
              Showing{" "}
              <span className="font-mono text-gray-900">
                {filteredInstances.length}
              </span>{" "}
              of{" "}
              <span className="font-mono text-gray-900">
                {items.length}
              </span>
            </span>
          </div>

          {filteredInstances.length === 0 ? (
            <div className="mt-2 flex-1 px-3 py-4 text-xs text-gray-500">
              No process instances found for current filters. Trigger reglament
              chains or adjust filters.
            </div>
          ) : (
            <div className="mt-1 min-h-0 flex-1 overflow-auto pr-1">
              <table className="min-w-full border-separate border-spacing-y-[4px] text-xs">
                <thead className="sticky top-0 bg-white text-[11px] text-gray-500">
                  <tr>
                    <th className="w-[110px] px-2 py-1 text-left font-medium">
                      Client
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Profile
                    </th>
                    <th className="w-[80px] px-2 py-1 text-left font-medium">
                      Period
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="w-[80px] px-2 py-1 text-left font-medium">
                      Steps
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Last event
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstances.map((inst) => {
                    const isSelected = selectedInstanceId === inst.id;
                    const displayStatus = getInstanceDisplayStatus(inst);
                    const stepsCount = inst.steps ? inst.steps.length : 0;

                    return (
                      <tr
                        key={inst.id}
                        className={
                          "cursor-pointer rounded-md border border-gray-100 bg-gray-50 text-[11px] text-gray-800 shadow-sm hover:border-blue-300 hover:bg-blue-50" +
                          (isSelected ? " border-blue-300 bg-blue-50" : "")
                        }
                        onClick={() => setSelectedInstanceId(inst.id)}
                      >
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[11px] text-gray-900">
                            {inst.client_id || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {inst.profile_code || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {inst.period || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                              getStatusPillClasses(displayStatus)
                            }
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[11px] text-gray-900">
                            {stepsCount}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="flex flex-col gap-0.5">
                            {inst.last_event_code && (
                              <span className="font-mono text-[10px] text-gray-800">
                                {inst.last_event_code}
                              </span>
                            )}
                            {inst.source && (
                              <span className="text-[10px] text-gray-500">
                                {inst.source}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: steps for selected instance */}
        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                Process steps
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Steps for the selected process instance. Derived status is
                computed from these steps on the backend.
              </p>
            </div>
            {selectedInstance && (
              <div className="text-right text-[10px] text-gray-500">
                <div>
                  Client:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedInstance.client_id || "n/a"}
                  </span>
                </div>
                <div>
                  Profile:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedInstance.profile_code || "n/a"}
                  </span>
                </div>
                <div>
                  Period:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedInstance.period || "n/a"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {!selectedInstance ? (
            <div className="flex-1 px-3 py-4 text-xs text-gray-500">
              Select a process instance on the left to see its steps.
            </div>
          ) : steps.length === 0 ? (
            <div className="flex-1 px-3 py-4 text-xs text-gray-500">
              This instance has no steps yet. Auto-steps will be created by
              backend when new control events are mapped to this process.
            </div>
          ) : (
            <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
              <table className="min-w-full border-separate border-spacing-y-[4px] text-xs">
                <thead className="text-[11px] text-gray-500">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">
                      Step
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="w-[120px] px-2 py-1 text-left font-medium">
                      Created
                    </th>
                    <th className="w-[120px] px-2 py-1 text-left font-medium">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr
                      key={step.id}
                      className="rounded-md border border-gray-100 bg-gray-50 text-[11px] text-gray-800"
                    >
                      <td className="px-2 py-1 align-top">
                        <div className="font-medium text-gray-900">
                          {step.title}
                        </div>
                      </td>
                      <td className="px-2 py-1 align-top">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                            getStepPillClasses(step.status)
                          }
                        >
                          {step.status || "pending"}
                        </span>
                      </td>
                      <td className="px-2 py-1 align-top">
                        <span className="font-mono text-[10px] text-gray-800">
                          {step.created_at || "n/a"}
                        </span>
                      </td>
                      <td className="px-2 py-1 align-top">
                        <span className="font-mono text-[10px] text-gray-800">
                          {step.completed_at || "n/a"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default InternalProcessesPage;
