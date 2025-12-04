import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
};

const DEMO_CLIENTS: { id: string; label: string }[] = [
  { id: "ip_usn_dr", label: "IP USN DR" },
  { id: "ooo_osno_3_zp1025", label: "OOO OSNO + VAT (3 emp, 10/25)" },
  {
    id: "ooo_usn_dr_tour_zp520",
    label: "OOO USN DR + tourist fee (2 emp, 5/20)"
  }
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
  { value: 12, label: "Dec" }
];

const now = new Date();

const ProcessCoveragePage: React.FC = () => {
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

      const results: Record<string, ClientCoverage> = {};

      await Promise.all(
        DEMO_CLIENTS.map(async (client) => {
          const url = `/api/control-events/${encodeURIComponent(
            client.id
          )}?${params.toString()}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            throw new Error(
              `Failed to load control events for ${client.id} (status ${resp.status})`
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
            const status = (e.status ?? "").toString().toLowerCase();
            if (status === "overdue") overdue += 1;
            else if (status === "completed") completed += 1;
            else if (status === "planned") planned += 1;

            const tags = e.tags ?? [];
            const processTags = tags.filter((t) => t.startsWith("process:"));
            for (const pt of processTags) {
              processTagSet.add(pt);
              if (!perProcess[pt]) {
                perProcess[pt] = {
                  total: 0,
                  overdue: 0,
                  planned: 0,
                  completed: 0
                };
              }
              perProcess[pt].total += 1;
              if (status === "overdue") perProcess[pt].overdue += 1;
              else if (status === "completed") perProcess[pt].completed += 1;
              else if (status === "planned") perProcess[pt].planned += 1;
            }
          }

          results[client.id] = {
            clientId: client.id,
            label: client.label,
            total,
            overdue,
            planned,
            completed,
            processTags: Array.from(processTagSet).sort(),
            perProcess
          };
        })
      );

      setCoverage(results);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load process coverage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoverage().catch(() => {
      // error handled in state
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const rows = useMemo(() => {
    return DEMO_CLIENTS.map((c) => coverage[c.id]).filter(
      (c): c is ClientCoverage => !!c
    );
  }, [coverage]);

  const currentMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? String(month);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Process coverage</h1>
          <p className="text-xs md:text-sm opacity-80">
            View how control events for demo clients are distributed over processes
            (process:* tags) for selected period.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <label className="text-xs font-medium opacity-70 mb-1">Year</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-sm w-24 bg-slate-900"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium opacity-70 mb-1">Month</label>
            <select
              className="border rounded px-2 py-1 text-sm bg-slate-900"
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
            className="px-3 py-1 rounded text-sm border border-sky-500 hover:bg-sky-500/10"
            onClick={loadCoverage}
            disabled={loading}
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </header>

      {err && (
        <div className="text-xs md:text-sm text-red-400 mb-2">{err}</div>
      )}

      <section className="border rounded-lg bg-white/5 overflow-auto">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-slate-900 text-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Overdue</th>
              <th className="px-3 py-2 text-left">Planned</th>
              <th className="px-3 py-2 text-left">Completed</th>
              <th className="px-3 py-2 text-left">Processes (process:*)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.clientId} className="border-t border-slate-800">
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-xs md:text-sm">
                    {c.label}
                  </div>
                  <div className="font-mono text-[11px] opacity-80">
                    {c.clientId}
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-[11px] md:text-xs">
                  {year} - {currentMonthLabel}
                </td>
                <td className="px-3 py-2 align-top">{c.total}</td>
                <td className="px-3 py-2 align-top">
                  {c.overdue > 0 ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-red-900/50 text-[11px]">
                      {c.overdue}
                    </span>
                  ) : (
                    c.overdue
                  )}
                </td>
                <td className="px-3 py-2 align-top">{c.planned}</td>
                <td className="px-3 py-2 align-top">{c.completed}</td>
                <td className="px-3 py-2 align-top">
                  {c.processTags.length === 0 && (
                    <span className="text-[11px] opacity-70">
                      No process tags for this period.
                    </span>
                  )}
                  {c.processTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.processTags.map((p) => (
                        <span
                          key={p}
                          className="inline-flex px-2 py-0.5 rounded-full border border-slate-700 text-[10px] md:text-xs"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-xs opacity-70"
                >
                  No data for selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {rows.map((c) => (
          <div
            key={c.clientId}
            className="border rounded-lg p-3 md:p-4 bg-white/5 text-xs md:text-sm space-y-2"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{c.label}</div>
                <div className="font-mono text-[11px] opacity-80">
                  {c.clientId}
                </div>
              </div>
              <div className="text-[11px] opacity-80 text-right">
                <div>
                  Total: <span className="font-medium">{c.total}</span>
                </div>
                <div>
                  Overdue:{" "}
                  <span className="font-medium text-red-300">
                    {c.overdue}
                  </span>
                </div>
              </div>
            </div>

            {c.processTags.length > 0 && (
              <div className="space-y-1">
                <div className="font-medium text-xs">
                  Processes activity (process:* tags)
                </div>
                <div className="space-y-1 max-h-40 overflow-auto border border-slate-800 rounded p-2">
                  {c.processTags.map((p) => {
                    const stats = c.perProcess[p];
                    return (
                      <div
                        key={p}
                        className="flex items-center justify-between text-[11px]"
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
          </div>
        ))}
      </section>

      <div className="text-xs md:text-sm opacity-80">
        <div>
          For detailed per-event view use{" "}
          <Link to="/control-events" className="underline">
            Control Events
          </Link>{" "}
          page.
        </div>
        <div>
          For tasks created from control events use{" "}
          <Link to="/tasks" className="underline">
            Tasks Dashboard
          </Link>{" "}
          page.
        </div>
      </div>
    </div>
  );
};

export default ProcessCoveragePage;
