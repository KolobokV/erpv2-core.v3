import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UpBackBar } from "../components/UpBackBar";

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

function useQuery(): URLSearchParams {
  return new URLSearchParams(useLocation().search);
}

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

function getStatusKey(status?: string): string {
  return (status || "").toLowerCase();
}

function getStatusBadgeClasses(status?: string): string {
  const s = getStatusKey(status);
  if (s === "new" || s === "planned") {
    return "bg-sky-50 text-sky-800 border-sky-200";
  }
  if (s === "in_progress" || s === "in-progress" || s === "open") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  if (s === "done" || s === "completed" || s === "closed") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  if (s === "error" || s === "failed") {
    return "bg-red-50 text-red-800 border-red-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getStatusLabel(status?: string): string {
  const s = getStatusKey(status);
  if (!s) return "-";
  if (s === "in_progress" || s === "in-progress") return "in progress";
  return s;
}

type DueSeverity = "none" | "ok" | "soon" | "overdue";

function getDueSeverity(raw?: string): DueSeverity {
  if (!raw) return "none";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "none";
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "ok";
}

function getDueClasses(severity: DueSeverity): string {
  if (severity === "overdue") return "text-red-700 font-semibold";
  if (severity === "soon") return "text-amber-700 font-semibold";
  if (severity === "ok") return "text-slate-800";
  return "text-slate-500";
}

const ControlEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const clientFromQuery =
    query.get("client_id") || query.get("client_code") || "ip_usn_dr";

  const now = new Date();
  const [clientId, setClientId] = useState<string>(clientFromQuery);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [items, setItems] = useState<ControlEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generateRunning, setGenerateRunning] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const periodLabel = `${year}-${String(month).padStart(2, "0")}`;

  const load = async () => {
    if (!clientId.trim()) {
      setError("Client id is required");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
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
        const da = a.due_date || (a as any).deadline || (a as any).date || "";
        const db = b.due_date || (b as any).deadline || (b as any).date || "";
        if (da < db) return -1;
        if (da > db) return 1;
        const sa = (a.status || "").toString().toLowerCase();
        const sb = (b.status || "").toString().toLowerCase();
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        return 0;
      });
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!clientId.trim()) {
      setError("Client id is required");
      return;
    }
    try {
      setGenerateRunning(true);
      setError(null);
      setMessage(null);
      const url = `/api/control-events/${encodeURIComponent(
        clientId.trim()
      )}/generate?year=${year}&month=${month}`;
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        throw new Error("Failed to generate control events: " + resp.status);
      }
      let msg = "Control events generated";
      try {
        const json = await resp.json();
        const maybe =
          (json as any).message ||
          (json as any).status ||
          (json as any).result ||
          null;
        if (maybe && typeof maybe === "string") {
          msg = maybe;
        }
      } catch {
        // ignore json parse errors
      }
      setMessage(`${msg} for period ${periodLabel}`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to generate control events");
    } finally {
      setGenerateRunning(false);
    }
  };

  const stats = useMemo(() => {
    let total = items.length;
    let newCount = 0;
    let plannedCount = 0;
    let doneCount = 0;
    let errorCount = 0;
    let overdueCount = 0;
    let soonCount = 0;

    for (const ev of items) {
      const statusKey = getStatusKey(ev.status);
      if (statusKey === "new" || statusKey === "planned") {
        newCount += 1;
      } else if (
        statusKey === "done" ||
        statusKey === "completed" ||
        statusKey === "closed"
      ) {
        doneCount += 1;
      } else if (statusKey === "error" || statusKey === "failed") {
        errorCount += 1;
      } else if (statusKey) {
        plannedCount += 1;
      }

      const severity = getDueSeverity(
        ev.due_date || (ev as any).deadline || (ev as any).date
      );
      if (severity === "overdue") overdueCount += 1;
      if (severity === "soon") soonCount += 1;
    }

    return {
      total,
      newCount,
      plannedCount,
      doneCount,
      errorCount,
      overdueCount,
      soonCount,
    };
  }, [items]);

  const handleSetCurrentMonth = () => {
    const nowLocal = new Date();
    setYear(nowLocal.getFullYear());
    setMonth(nowLocal.getMonth() + 1);
  };

  return (
    <div className="space-y-4 p-4">
      <UpBackBar
        title="Control events"
        onUp={() => navigate("/")}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a className="erp-btn erp-btn-ghost" href={clientId ? ("/day?client=" + encodeURIComponent(clientId)) : "/day"}>Day</a>
            <a className="erp-btn erp-btn-ghost" href={clientId ? ("/tasks?client=" + encodeURIComponent(clientId)) : "/tasks"}>Tasks</a>
            <a className="erp-btn erp-btn-ghost" href={clientId ? ("/client-profile?client=" + encodeURIComponent(clientId)) : "/client-profile"}>Client</a>
          </div>
        }
      />
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Control events by client
        </h1>
        <p className="text-sm text-slate-600">
          Load and manage control events from /api/control-events/&lt;client_id&gt; for selected period. Supports client_id in query string.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm space-y-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Client id
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="ip_usn_dr, ooo_osno_3_zp1025..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Year
            </label>
            <input
              type="number"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={year}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) setYear(v);
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
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
                if (!Number.isNaN(v) && v >= 1 && v <= 12) {
                  setMonth(v);
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSetCurrentMonth}
              className="mt-4 inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Current month
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading || generateRunning}
              className="mt-4 inline-flex flex-1 items-center justify-center rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Load events"}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generateRunning || loading}
              className="mt-4 inline-flex flex-1 items-center justify-center rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {generateRunning ? "Generating..." : "Generate for period"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            <span className="font-semibold">Client:</span> {clientId || "not set"}
          </div>
          <div>
            <span className="font-semibold">Period:</span> {periodLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <div className="text-slate-500">Total events</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-sky-700">New / planned</div>
          <div className="mt-1 text-lg font-semibold text-sky-900">
            {stats.newCount + stats.plannedCount}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-emerald-700">Done</div>
          <div className="mt-1 text-lg font-semibold text-emerald-900">
            {stats.doneCount}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-red-700">Errors</div>
          <div className="mt-1 text-lg font-semibold text-red-900">
            {stats.errorCount}
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-red-700">Overdue</div>
          <div className="mt-1 text-lg font-semibold text-red-900">
            {stats.overdueCount}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-amber-700">Due soon (2 days)</div>
          <div className="mt-1 text-lg font-semibold text-amber-900">
            {stats.soonCount}
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No control events loaded for selected client and period.
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Control events for client {clientId}
            </h2>
            <span className="text-xs text-slate-500">
              {items.length} items for {periodLabel}
            </span>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[110px]">
                    Status
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium">
                    Event
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[130px]">
                    Due date
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[110px]">
                    Period
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[140px]">
                    Code
                  </th>
                  <th className="border-b border-slate-100 px-2 py-2 text-left font-medium w-[160px]">
                    Client id
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((ev, index) => {
                  const status = ev.status || "-";
                  const statusLabel = getStatusLabel(status);
                  const statusClasses = getStatusBadgeClasses(status);
                  const dueRaw =
                    ev.due_date || (ev as any).deadline || (ev as any).date || "";
                  const dueFormatted = formatDate(dueRaw);
                  const severity = getDueSeverity(dueRaw);
                  const dueClasses = getDueClasses(severity);
                  const period = (ev as any).period || periodLabel;
                  const label = ev.label || ev.code || ev.id || "-";
                  const client = ev.client_id || clientId || "-";
                  const rowStripe =
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/40";

                  return (
                    <tr key={ev.id || ev.code || index} className={rowStripe}>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <span
                          className={
                            "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium " +
                            statusClasses
                          }
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <div
                          className="truncate font-medium text-slate-900"
                          title={label.toString()}
                        >
                          {label}
                        </div>
                        {ev.code && (
                          <div className="truncate text-[11px] text-slate-500">
                            {ev.code}
                          </div>
                        )}
                      </td>
                      <td
                        className={
                          "border-b border-slate-100 px-2 py-1.5 align-middle " +
                          dueClasses
                        }
                      >
                        {dueFormatted}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        {String(period)}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        {ev.code || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-2 py-1.5 align-middle">
                        <div className="truncate text-slate-800" title={String(client)}>
                          {client}
                        </div>
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
