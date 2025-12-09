import React, { useEffect, useState } from "react";

type ChainRun = {
  id?: string;
  client_id?: string;
  year?: number;
  month?: number;
  status?: string;
  process_status?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string | null;
  steps?: any[];
  control_events?: any[];
  [key: string]: any;
};

type RunsResponse =
  | ChainRun[]
  | {
      items?: ChainRun[];
      runs?: ChainRun[];
      [key: string]: any;
    }
  | null
  | undefined;

function toRunsList(data: RunsResponse): ChainRun[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as ChainRun[];
  if (Array.isArray((data as any).runs)) return (data as any).runs as ChainRun[];
  return [];
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function getRunStatus(run: ChainRun): string {
  if (run.status && typeof run.status === "string" && run.status.trim().length > 0) {
    return run.status;
  }
  if (run.process_status && typeof run.process_status === "string") {
    if (run.process_status === "completed") return "ok";
    if (run.process_status === "error") return "error";
    return run.process_status;
  }
  const events = Array.isArray(run.control_events) ? run.control_events : [];
  if (events.length > 0) {
    const hasError = events.some((ev: any) => ev && (ev.status === "error" || ev.status === "failed"));
    return hasError ? "error" : "ok";
  }
  return "-";
}

function getRunStartedAt(run: ChainRun): string | undefined {
  return run.started_at || run.created_at;
}

function getRunFinishedAt(run: ChainRun): string | undefined {
  return run.finished_at || run.created_at;
}

function getRunStepsCount(run: ChainRun): number {
  if (Array.isArray(run.steps)) return run.steps.length;
  if (Array.isArray(run.control_events)) return run.control_events.length;
  return 0;
}

const ProcessChainsDevPage: React.FC = () => {
  const now = new Date();
  const [items, setItems] = useState<ChainRun[]>([]);
  const [selected, setSelected] = useState<ChainRun | null>(null);

  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("ip_usn_dr");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [running, setRunning] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<string | null>(null);

  const loadRuns = async () => {
    try {
      setLoadingList(true);
      setListError(null);
      const resp = await fetch("/api/internal/process-chains/dev/");
      if (!resp.ok) {
        throw new Error("Failed to load chains dev: " + resp.status);
      }
      const data: RunsResponse = await resp.json();
      const list = toRunsList(data);
      list.sort((a, b) => {
        const sa = getRunStartedAt(a) || "";
        const sb = getRunStartedAt(b) || "";
        if (sa > sb) return -1;
        if (sa < sb) return 1;
        return 0;
      });
      setItems(list);
      if (list.length > 0) {
        setSelected(list[0]);
      } else {
        setSelected(null);
      }
    } catch (e: any) {
      setListError(e?.message || "Unknown error");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await loadRuns();
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRunForClient = async () => {
    if (!clientId.trim()) {
      setRunError("Client id is required");
      return;
    }
    try {
      setRunning(true);
      setRunError(null);
      setRunInfo(null);
      const url = `/api/internal/process-chains/dev/run-for-client/${encodeURIComponent(
        clientId.trim()
      )}?year=${year}&month=${month}`;
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        throw new Error("Run failed: " + resp.status);
      }
      const json = await resp.json();
      const status = (json as any).status || (json as any).result || "ok";
      setRunInfo(`Run completed with status: ${status}`);
      await loadRuns();
    } catch (e: any) {
      setRunError(e?.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Process chains dev</h1>
        <p className="text-sm text-slate-700">
          Dev executor and history from process_chains_store.json.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Client id
            </label>
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="client key, e.g. ip_usn_dr"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Year
            </label>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Month
            </label>
            <input
              type="number"
              min={1}
              max={12}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={month}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v) && v >= 1 && v <= 12) setMonth(v);
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRunForClient}
              className="mt-5 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={running}
            >
              {running ? "Running..." : "Run for client"}
            </button>
            <button
              type="button"
              onClick={loadRuns}
              className="mt-5 inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loadingList}
            >
              {loadingList ? "Reloading..." : "Reload list"}
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-600">
          Period: <span className="font-mono">{periodLabel}</span>
        </div>

        {runError && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
            Run error: {runError}
          </div>
        )}
        {runInfo && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {runInfo}
          </div>
        )}
      </div>

      {loadingList && items.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          Loading chain runs...
        </div>
      )}

      {listError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Error: {listError}
        </div>
      )}

      {!loadingList && !listError && items.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          No chain runs found yet. Use{" "}
          <span className="font-medium">Run for client</span> to create dev records.
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Runs ({items.length})
              </span>
            </div>
            <div className="max-h-[480px] overflow-auto text-sm">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Finished</th>
                    <th className="px-3 py-2">Steps</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isSelected = selected === item;
                    const period =
                      item.year && item.month
                        ? `${item.year}-${String(item.month).padStart(2, "0")}`
                        : item.period || "-";
                    const stepsCount = getRunStepsCount(item);
                    const status = getRunStatus(item);
                    const started = getRunStartedAt(item);
                    const finished = getRunFinishedAt(item);

                    return (
                      <tr
                        key={item.id || idx}
                        className={
                          "cursor-pointer border-t border-slate-100 " +
                          (isSelected ? "bg-emerald-50" : "hover:bg-slate-50")
                        }
                        onClick={() => setSelected(item)}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">
                            {item.client_id || "-"}
                          </div>
                          {item.id && (
                            <div className="text-[10px] text-slate-500">
                              {item.id}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{period}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                              (status === "ok" || status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : status === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-700")
                            }
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatDate(started || null)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatDate(finished || null)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{stepsCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Selected run details
              </span>
            </div>
            <div className="p-3 text-xs font-mono bg-slate-50 max-h-[480px] overflow-auto">
              {selected ? (
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              ) : (
                <span className="text-slate-600">No run selected.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessChainsDevPage;
