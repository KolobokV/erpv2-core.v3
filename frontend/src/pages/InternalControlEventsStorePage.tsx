import React, { useEffect, useState } from "react";

type ControlEvent = {
  id?: string;
  client_id?: string;
  client_label?: string;
  year?: number;
  month?: number;
  period?: string;
  code?: string;
  label?: string;
  due_date?: string;
  planned_date?: string;
  status?: string;
  [key: string]: any;
};

type StoreResponse =
  | ControlEvent[]
  | {
      items?: ControlEvent[];
      events?: ControlEvent[];
      [key: string]: any;
    }
  | null
  | undefined;

function toList(data: StoreResponse): ControlEvent[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as ControlEvent[];
  if (Array.isArray((data as any).events)) return (data as any).events as ControlEvent[];
  return [];
}

function getPeriod(ev: ControlEvent): string {
  if (typeof ev.period === "string" && ev.period.trim().length > 0) return ev.period;
  if (ev.year && ev.month) {
    return `${ev.year}-${String(ev.month).padStart(2, "0")}`;
  }
  return "-";
}

function getDueDate(ev: ControlEvent): string {
  const raw = ev.due_date || ev.planned_date || ev.date || ev.deadline;
  if (!raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString();
}

const InternalControlEventsStorePage: React.FC = () => {
  const [items, setItems] = useState<ControlEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ControlEvent | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch("/api/internal/control-events-store/");
        if (!resp.ok) {
          throw new Error("Failed to load control events store: " + resp.status);
        }
        const data: StoreResponse = await resp.json();
        const list = toList(data);
        list.sort((a, b) => {
          const ca = a.client_id || "";
          const cb = b.client_id || "";
          if (ca < cb) return -1;
          if (ca > cb) return 1;
          const pa = getPeriod(a);
          const pb = getPeriod(b);
          if (pa < pb) return -1;
          if (pa > pb) return 1;
          return 0;
        });
        if (isMounted) {
          setItems(list);
          setSelected(list[0] ?? null);
        }
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || "Unknown error");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Internal control events store</h1>
        <p className="text-sm text-slate-600">
          Read-only view of all control events stored in control_events_store.json.
        </p>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          Loading control events store...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          Store is empty. Use scheduler / chains to generate control events.
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Events ({items.length})
              </span>
            </div>
            <div className="max-h-[480px] overflow-auto text-xs">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ev, idx) => {
                    const isSelected = selected === ev;
                    const clientLabel = ev.client_label || ev.client_id || "-";
                    const period = getPeriod(ev);
                    const due = getDueDate(ev);
                    const status = ev.status || "-";
                    const code = ev.code || ev.event_code || "-";
                    const label = ev.label || ev.event_label || ev.title || "-";

                    return (
                      <tr
                        key={ev.id || idx}
                        className={
                          "cursor-pointer border-t border-slate-100 " +
                          (isSelected ? "bg-emerald-50" : "hover:bg-slate-50")
                        }
                        onClick={() => setSelected(ev)}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800">{clientLabel}</div>
                          {ev.client_id && (
                            <div className="text-[10px] text-slate-500">{ev.client_id}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{period}</td>
                        <td className="px-3 py-2 text-slate-700">{code}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <div className="truncate max-w-[220px]" title={label}>
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

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Selected event details
              </span>
            </div>
            <div className="p-3 text-xs font-mono bg-slate-50 max-h-[480px] overflow-auto">
              {selected ? (
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              ) : (
                <span className="text-slate-600">No event selected.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalControlEventsStorePage;
