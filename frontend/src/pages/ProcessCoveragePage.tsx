import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const CLIENT_PROFILE_FOCUS_KEY = "erpv2_client_profile_focus";

type ControlEvent = {
  id: string;
  client_id: string;
  date: string;
  title: string;
  category: string;
  status: string;
  depends_on?: string[];
  description?: string;
  tags?: string[];
  source?: string;
};

type ProcessInstance = {
  id: string;
  client_id?: string;
  period?: string;
  status?: string;
  computed_status?: string;
};

type InstanceStatusSummary = {
  total: number;
  open: number;
  waiting: number;
  completed: number;
  error: number;
  other: number;
};

type ClientCoverage = {
  clientId: string;
  label: string;
  total: number;
  overdue: number;
  planned: number;
  completed: number;
  processTags: string[];
  perProcess: Record<
    string,
    { total: number; overdue: number; planned: number; completed: number }
  >;
  processInstances?: InstanceStatusSummary;
};

const DEMO_CLIENTS: { id: string; label: string }[] = [
  { id: "ip_usn_dr", label: "IP USN DR" },
  { id: "ooo_osno_3_zp1025", label: "OOO OSNO + VAT (3 emp, 10/25)" },
  {
    id: "ooo_usn_dr_tour_zp520",
    label: "OOO USN DR + tourist fee (2 emp, 5/20)",
  },
];

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const now = new Date();

function normalizeStatus(status?: string | null): string {
  if (!status) return "open";
  const s = status.toString().trim().toLowerCase();
  return s || "open";
}

function getDisplayStatus(inst: ProcessInstance): string {
  return normalizeStatus(inst.computed_status || inst.status || "open");
}

function summarizeInstancesForClientPeriod(
  instances: ProcessInstance[],
  clientId: string,
  year: number,
  month: number,
): InstanceStatusSummary {
  const mm = month < 10 ? `0${month}` : String(month);
  const periodPrefix = `${year}-${mm}`;

  const summary: InstanceStatusSummary = {
    total: 0,
    open: 0,
    waiting: 0,
    completed: 0,
    error: 0,
    other: 0,
  };

  for (const inst of instances) {
    if (!inst.client_id || !inst.period) continue;
    if (inst.client_id !== clientId) continue;
    if (!inst.period.startsWith(periodPrefix)) continue;

    summary.total += 1;
    const s = getDisplayStatus(inst);

    if (s === "open") summary.open += 1;
    else if (s === "waiting") summary.waiting += 1;
    else if (s === "completed") summary.completed += 1;
    else if (s === "error" || s === "failed") summary.error += 1;
    else summary.other += 1;
  }

  return summary;
}

const ProcessCoveragePage: React.FC = () => {
  const navigate = useNavigate();

  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [coverage, setCoverage] = useState<Record<string, ClientCoverage>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const loadCoverage = async () => {
    setLoading(true);
    setErr(null);
    setCoverage({});

    try {
      const params = new URLSearchParams();
      if (year) params.append("year", String(year));
      if (month) params.append("month", String(month));

      const instResp = await fetch("/api/internal/process-instances");
      if (!instResp.ok) {
        throw new Error(
          `Failed to load process instances (status ${instResp.status})`,
        );
      }
      const instJson = await instResp.json();
      const allInstances: ProcessInstance[] = Array.isArray(instJson)
        ? instJson
        : instJson?.items ?? [];

      const results: Record<string, ClientCoverage> = {};

      await Promise.all(
        DEMO_CLIENTS.map(async (client) => {
          const url = `/api/control-events/${encodeURIComponent(
            client.id,
          )}?${params.toString()}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            throw new Error(
              `Failed to load control events for ${client.id} (status ${resp.status})`,
            );
          }
          const json = await resp.json();
          const events: ControlEvent[] = (json?.events ?? []) as ControlEvent[];

          let total = 0;
          let overdue = 0;
          let planned = 0;
          let completed = 0;

          const processTagSet = new Set<string>();
          const perProcess: ClientCoverage["perProcess"] = {};

          for (const e of events) {
            total += 1;
            const status = normalizeStatus(e.status);

            if (!e.status || status === "planned") {
              planned += 1;
            } else if (status === "overdue" || status === "late") {
              overdue += 1;
            } else if (status === "completed") {
              completed += 1;
            }

            const tags = e.tags ?? [];
            const processTags = tags.filter((t) => t.startsWith("process:"));
            for (const pt of processTags) {
              processTagSet.add(pt);
              if (!perProcess[pt]) {
                perProcess[pt] = {
                  total: 0,
                  overdue: 0,
                  planned: 0,
                  completed: 0,
                };
              }
              perProcess[pt].total += 1;
              if (status === "overdue" || status === "late") {
                perProcess[pt].overdue += 1;
              } else if (status === "completed") {
                perProcess[pt].completed += 1;
              } else if (!e.status || status === "planned") {
                perProcess[pt].planned += 1;
              }
            }
          }

          const instanceSummary = summarizeInstancesForClientPeriod(
            allInstances,
            client.id,
            year,
            month,
          );

          results[client.id] = {
            clientId: client.id,
            label: client.label,
            total,
            overdue,
            planned,
            completed,
            processTags: Array.from(processTagSet).sort(),
            perProcess,
            processInstances:
              instanceSummary.total > 0 ? instanceSummary : undefined,
          };
        }),
      );

      setCoverage(results);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load process coverage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoverage().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const rows = useMemo(() => {
    return DEMO_CLIENTS.map((c) => coverage[c.id]).filter(
      (c): c is ClientCoverage => !!c,
    );
  }, [coverage]);

  const currentMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? String(month);

  const handleOpenClientProfile = (clientId: string) => {
    try {
      const payload = { clientId, year, month };
      window.localStorage.setItem(
        CLIENT_PROFILE_FOCUS_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // ignore
    }
    navigate("/client-profile");
  };

  const handleOpenClientOverview = (clientId: string) => {
    try {
      const payload = { clientId, year, month };
      window.localStorage.setItem(
        CLIENT_PROFILE_FOCUS_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // ignore
    }
    navigate("/client-process-overview");
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <header className="mb-1 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">Process coverage</h1>
          <p className="text-xs md:text-sm opacity-80 max-w-2xl">
            Radar for three demo clients: how control events are distributed over
            processes (process:* tags) for the selected period and whether live
            process instances exist in the JSON store.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium opacity-80">
              Year
            </label>
            <input
              type="number"
              className="h-8 w-24 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-900"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium opacity-80">
              Month
            </label>
            <select
              className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px]"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="inline-flex h-8 items-center rounded-md border border-sky-500 px-3 text-[11px] font-medium text-sky-900 hover:bg-sky-50 disabled:opacity-60"
            onClick={loadCoverage}
            disabled={loading}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </header>

      {err && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      )}

      {/* Table */}
      <section className="overflow-auto rounded-xl border border-slate-200 bg-white text-xs shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-[11px] font-medium text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Overdue</th>
              <th className="px-3 py-2 text-left">Planned</th>
              <th className="px-3 py-2 text-left">Completed</th>
              <th className="px-3 py-2 text-left">Processes (process:*)</th>
              <th className="px-3 py-2 text-left">Instances</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.clientId}
                className="border-t border-slate-100 bg-white"
              >
                <td className="px-3 py-2 align-top">
                  <div className="font-semibold text-slate-900">
                    {c.label}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {c.clientId}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-[11px] text-slate-600">
                  {year} - {currentMonthLabel}
                </td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-900">
                  {c.total}
                </td>
                <td className="px-3 py-2 align-top">
                  {c.overdue > 0 ? (
                    <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 font-mono text-[11px] text-rose-700">
                      {c.overdue}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-slate-800">
                      {c.overdue}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-800">
                  {c.planned}
                </td>
                <td className="px-3 py-2 align-top font-mono text-[11px] text-slate-800">
                  {c.completed}
                </td>
                <td className="px-3 py-2 align-top">
                  {c.processTags.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      No process tags for this period.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {c.processTags.map((p) => (
                        <span
                          key={p}
                          className="inline-flex rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-mono text-slate-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  {c.processInstances ? (
                    <div className="space-y-1 text-[11px] text-slate-700">
                      <div>
                        total:&nbsp;
                        <span className="font-mono">
                          {c.processInstances.total}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-sky-500" />
                          <span className="font-mono">
                            {c.processInstances.open}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="font-mono">
                            {c.processInstances.waiting}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="font-mono">
                            {c.processInstances.completed}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span className="font-mono">
                            {c.processInstances.error}
                          </span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      No process instances for this period.
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex flex-col gap-1 text-[11px]">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md border border-slate-400 px-2 py-0.5 text-slate-800 hover:bg-slate-50"
                      onClick={() => handleOpenClientProfile(c.clientId)}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md border border-sky-500 px-2 py-0.5 text-sky-900 hover:bg-sky-50"
                      onClick={() => handleOpenClientOverview(c.clientId)}
                    >
                      Overview
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-4 text-center text-xs text-slate-500"
                >
                  No data for selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Cards */}
      <section className="grid gap-3 md:grid-cols-2">
        {rows.map((c) => (
          <div
            key={c.clientId}
            className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {c.label}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  {c.clientId}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <div>
                  Total:{" "}
                  <span className="font-mono text-slate-900">{c.total}</span>
                </div>
                <div>
                  Overdue:{" "}
                  <span className="font-mono text-rose-600">
                    {c.overdue}
                  </span>
                </div>
              </div>
            </div>

            {c.processTags.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-700">
                  Processes activity (process:* tags)
                </div>
                <div className="max-h-40 space-y-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                  {c.processTags.map((p) => {
                    const stats = c.perProcess[p];
                    return (
                      <div
                        key={p}
                        className="flex items-center justify-between text-[11px] text-slate-700"
                      >
                        <span className="font-mono">{p}</span>
                        <span className="space-x-2">
                          <span>total: {stats.total}</span>
                          <span>over: {stats.overdue}</span>
                          <span>plan: {stats.planned}</span>
                          <span>comp: {stats.completed}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {c.processInstances && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-slate-700">
                  Process instances this period
                </div>
                <div className="space-y-0.5 text-[11px] text-slate-700">
                  <div>
                    total:&nbsp;
                    <span className="font-mono">
                      {c.processInstances.total}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-sky-500" />
                      <span className="font-mono">
                        {c.processInstances.open}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-mono">
                        {c.processInstances.waiting}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-mono">
                        {c.processInstances.completed}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      <span className="font-mono">
                        {c.processInstances.error}
                      </span>
                    </span>
                  </div>
                  {c.processInstances.other > 0 && (
                    <div className="text-[10px] text-slate-400">
                      other statuses: {c.processInstances.other}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-slate-400 px-2 py-0.5 text-[11px] text-slate-800 hover:bg-slate-50"
                onClick={() => handleOpenClientProfile(c.clientId)}
              >
                Open profile
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-sky-500 px-2 py-0.5 text-[11px] text-sky-900 hover:bg-sky-50"
                onClick={() => handleOpenClientOverview(c.clientId)}
              >
                Client overview
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="space-y-1 text-xs text-slate-500">
        <div>
          For detailed per-event view use{" "}
          <Link to="/control-events" className="text-sky-700 underline">
            Control events
          </Link>
          .
        </div>
        <div>
          For tasks created from control events use{" "}
          <Link to="/tasks" className="text-sky-700 underline">
            Tasks dashboard
          </Link>
          .
        </div>
        <div>
          For per-client process instances and steps use{" "}
          <Link to="/client-process-overview" className="text-sky-700 underline">
            Client process overview
          </Link>
          .
        </div>
      </div>
    </div>
  );
};

export default ProcessCoveragePage;
