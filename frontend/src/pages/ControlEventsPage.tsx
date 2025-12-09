import React, { useState } from "react";

type ControlEvent = {
  id?: string;
  client_id?: string;
  label?: string;
  code?: string;
  due_date?: string;
  status?: string;
  [key: string]: any;
};

type ControlEventsResponse =
  | ControlEvent[]
  | {
      items?: ControlEvent[];
      events?: ControlEvent[];
      [key: string]: any;
    }
  | null
  | undefined;

function toList(data: ControlEventsResponse): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as ControlEvent[];
  if (Array.isArray((data as any).events)) return (data as any).events as ControlEvent[];
  return [];
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const ControlEventsPage: React.FC = () => {
  const now = new Date();
  const [clientId, setClientId] = useState<string>("ip_usn_dr");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [items, setItems] = useState<ControlEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!clientId.trim()) {
      setError("Client id is required");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setItems([]);
      const url = `/api/control-events/${encodeURIComponent(
        clientId.trim()
      )}?year=${year}&month=${month}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error("Failed to load control events: " + resp.status);
      }
      const data: ControlEventsResponse = await resp.json();
      const list = toList(data);
      list.sort((a, b) => {
        const da = a.due_date || a.date || "";
        const db = b.due_date || b.date || "";
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Control events by client</h1>
        <p className="text-sm text-slate-600">
          Load control events from API /api/control-events/&lt;client_id&gt; for selected period.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
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
            <label className="block text-xs font-medium text-slate-600 mb-1">
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
            <label className="block text-xs font-medium text-slate-600 mb-1">
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
              onClick={load}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
              disabled={loading}
            >
              {loading ? "Loading..." : "Load events"}
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Current period: <span className="font-mono">{periodLabel}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          No events loaded. Set client and period, then press{" "}
          <span className="font-medium">Load events</span>.
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white text-xs">
          <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-800">
              Events for {clientId} ({periodLabel}) — {items.length} total
            </span>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev, idx) => {
                  const code = ev.code || ev.event_code || "-";
                  const label = ev.label || ev.event_label || ev.title || "-";
                  const due = formatDate(ev.due_date || (ev as any).date);
                  const status = ev.status || "-";
                  return (
                    <tr key={ev.id || idx} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{code}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="truncate max-w-[260px]" title={label}>
                          {label}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{due}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                            (status === "done" || status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : status === "error"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-700")
                          }
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlEventsPage;
