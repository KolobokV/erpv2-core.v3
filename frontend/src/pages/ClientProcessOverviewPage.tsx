import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const CLIENT_PROFILE_FOCUS_KEY = "erpv2_client_profile_focus";

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

type OverviewEventPayload = {
  id?: string;
  client_id?: string;
  date?: string;
  title?: string;
  category?: string;
  status?: string;
  depends_on?: string[];
  description?: string;
  tags?: string[];
  source?: string;
  period?: string;
  event_code?: string;
};

type OverviewEventRow = {
  event: OverviewEventPayload;
  instance_id?: string | null;
  instance_status?: string | null;
  instance_steps_count?: number | null;
};

type ProcessStep = {
  id?: string;
  title?: string;
  status?: string;
  created_at?: string | null;
  completed_at?: string | null;
};

type ProcessInstance = {
  id?: string;
  client_id?: string;
  profile_code?: string;
  definition_id?: string;
  definition_name?: string;
  period?: string;
  month?: string | number;
  status?: string;
  last_event_code?: string | null;
  events?: string[];
  steps?: ProcessStep[];
  created_at?: string | null;
  updated_at?: string | null;
};

type ClientProcessOverviewResponse = {
  client_id: string;
  year: number;
  month: number;
  period: string;
  events: OverviewEventRow[];
  instances: ProcessInstance[];
};

const now = new Date();

const ClientProcessOverviewPage: React.FC = () => {
  const [clientId, setClientId] = useState<string>("");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [overview, setOverview] =
    useState<ClientProcessOverviewResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // ===== PREFILL CLIENT FROM LOCAL STORAGE / DEMO =====
  useEffect(() => {
    let fromFocus: string | null = null;

    try {
      const raw = window.localStorage.getItem(CLIENT_PROFILE_FOCUS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.clientId === "string" && parsed.clientId) {
          fromFocus = parsed.clientId;
        }
      }
    } catch {
      // ignore storage errors
    }

    if (fromFocus) {
      setClientId(fromFocus);
    } else if (DEMO_CLIENTS.length > 0) {
      setClientId(DEMO_CLIENTS[0].id);
    }
  }, []);

  const selectedInstance: ProcessInstance | null = useMemo(() => {
    if (!overview || !selectedInstanceId) return null;
    return (
      overview.instances.find((inst) => inst.id === selectedInstanceId) || null
    );
  }, [overview, selectedInstanceId]);

  const selectedEvent: OverviewEventRow | null = useMemo(() => {
    if (!overview || !selectedEventId) return null;
    return (
      overview.events.find((row) => row.event.id === selectedEventId) || null
    );
  }, [overview, selectedEventId]);

  const stepsForSelectedInstance: ProcessStep[] = useMemo(() => {
    if (!selectedInstance || !Array.isArray(selectedInstance.steps)) {
      return [];
    }
    const steps = [...selectedInstance.steps];

    steps.sort((a, b) => {
      const aKey = (a.created_at || "") + (a.id || "");
      const bKey = (b.created_at || "") + (b.id || "");
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return 0;
    });

    return steps;
  }, [selectedInstance]);

  const eventsSorted: OverviewEventRow[] = useMemo(() => {
    if (!overview) return [];
    const copy = [...overview.events];

    copy.sort((a, b) => {
      const ea = a.event;
      const eb = b.event;
      const aKey = (ea.date || "") + (ea.id || "");
      const bKey = (eb.date || "") + (eb.id || "");
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return 0;
    });

    return copy;
  }, [overview]);

  const instancesSorted: ProcessInstance[] = useMemo(() => {
    if (!overview) return [];
    const copy = [...overview.instances];

    copy.sort((a, b) => {
      const aPeriod = (a.period || "") + (a.id || "");
      const bPeriod = (b.period || "") + (b.id || "");
      if (aPeriod < bPeriod) return -1;
      if (aPeriod > bPeriod) return 1;
      return 0;
    });

    return copy;
  }, [overview]);

  const handleLoadOverview = async () => {
    const trimmed = clientId.trim();
    if (!trimmed) {
      setErr("Client id is required");
      return;
    }

    setLoading(true);
    setErr(null);
    setOverview(null);
    setSelectedEventId(null);
    setSelectedInstanceId(null);
    setSelectedStepId(null);

    try {
      const params = new URLSearchParams();
      if (year) params.append("year", String(year));
      if (month) params.append("month", String(month));

      const url = `/api/internal/process-overview/client/${encodeURIComponent(
        trimmed
      )}?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Failed to load process overview (HTTP ${res.status})`
        );
      }

      const json: ClientProcessOverviewResponse = await res.json();
      setOverview(json);

      if (json.events && json.events.length > 0) {
        const first = json.events[0];
        if (first.event && first.event.id) {
          setSelectedEventId(first.event.id);
        }
        if (first.instance_id) {
          setSelectedInstanceId(first.instance_id);
        }
      } else if (json.instances && json.instances.length > 0) {
        setSelectedInstanceId(json.instances[0].id || null);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load process overview");
    } finally {
      setLoading(false);
    }
  };

  // ===== SMALL HELPERS =====
  const currentMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? String(month);

  const summary = useMemo(() => {
    if (!overview) {
      return {
        events: 0,
        eventsAttached: 0,
        eventsWithoutInstance: 0,
        instances: 0,
      };
    }

    const totalEvents = overview.events.length;
    let attached = 0;

    for (const row of overview.events) {
      if (row.instance_id) attached += 1;
    }

    const instancesCount = overview.instances.length;

    return {
      events: totalEvents,
      eventsAttached: attached,
      eventsWithoutInstance: totalEvents - attached,
      instances: instancesCount,
    };
  }, [overview]);

  // ===== RENDER HELPERS =====
  const renderEventStatusBadge = (statusRaw?: string) => {
    const status = (statusRaw || "").toLowerCase();
    let classes =
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ";

    if (status === "overdue" || status === "late") {
      classes += "border-red-200 bg-red-50 text-red-700";
    } else if (status === "completed" || status === "done") {
      classes += "border-emerald-200 bg-emerald-50 text-emerald-700";
    } else {
      classes += "border-gray-200 bg-gray-50 text-gray-700";
    }

    return <span className={classes}>{statusRaw || "planned"}</span>;
  };

  const renderInstanceStatusBadge = (statusRaw?: string) => {
    const status = (statusRaw || "").toLowerCase();
    let classes =
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ";

    if (status === "completed") {
      classes += "border-green-200 bg-green-50 text-green-700";
    } else if (status === "ready") {
      classes += "border-gray-200 bg-gray-50 text-gray-700";
    } else if (status === "error") {
      classes += "border-red-200 bg-red-50 text-red-700";
    } else {
      classes += "border-yellow-200 bg-yellow-50 text-yellow-700";
    }

    return <span className={classes}>{statusRaw || "n/a"}</span>;
  };

  const renderStepStatusBadge = (statusRaw?: string) => {
    const status = (statusRaw || "").toLowerCase();
    let classes =
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ";

    if (status === "done" || status === "completed") {
      classes += "border-green-200 bg-green-50 text-green-700";
    } else if (status === "error") {
      classes += "border-red-200 bg-red-50 text-red-700";
    } else {
      classes += "border-gray-200 bg-gray-50 text-gray-700";
    }

    return <span className={classes}>{statusRaw || "planned"}</span>;
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      {/* Header / filters */}
      <header className="flex flex-col gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-slate-50 md:text-lg">
            Client process overview
          </h1>
          <p className="text-[11px] text-slate-200 md:text-xs">
            Variant B layout: left column – control events, middle – process
            instances, right – steps of selected instance.
          </p>
          {overview && (
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-200/90">
              <span>
                Client:{" "}
                <span className="font-mono text-slate-50">
                  {overview.client_id}
                </span>
              </span>
              <span>
                Period:{" "}
                <span className="font-mono text-slate-50">
                  {overview.period} ({overview.year}-{overview.month})
                </span>
              </span>
              <span>
                Events:{" "}
                <span className="font-semibold">
                  {summary.events} total, {summary.eventsAttached} linked,{" "}
                  {summary.eventsWithoutInstance} orphan
                </span>
              </span>
              <span>
                Instances:{" "}
                <span className="font-semibold">{summary.instances}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium text-slate-200">
              Demo client
            </label>
            <select
              className="w-52 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-50"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Custom</option>
              {DEMO_CLIENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium text-slate-200">
              Client id
            </label>
            <input
              type="text"
              className="w-52 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-50 font-mono"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="client id"
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium text-slate-200">
              Year
            </label>
            <input
              type="number"
              className="w-24 rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-50"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-[11px] font-medium text-slate-200">
              Month
            </label>
            <select
              className="rounded border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-50"
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
            type="button"
            className="rounded border border-sky-400 px-3 py-1 text-xs font-medium text-sky-100 hover:bg-sky-500/10 disabled:opacity-60"
            onClick={handleLoadOverview}
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : `Load ${currentMonthLabel.toLowerCase()} ${year}`}
          </button>
        </div>
      </header>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
          {err}
        </div>
      )}

      {/* Main grid: events | instances | steps */}
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
        {/* Left: events */}
        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 border-b border-gray-100 pb-1">
            <h2 className="text-sm font-semibold text-gray-800">
              Control events
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              All control events for selected client and period. Click a row to
              focus linked process instance (if any).
            </p>
          </div>

          {!overview && !loading && (
            <div className="flex-1 px-2 py-4 text-xs text-gray-500">
              Load overview to see events, instances and steps.
            </div>
          )}

          {overview && (
            <div className="flex-1 overflow-auto rounded border border-gray-200 bg-gray-50">
              <table className="min-w-full border-collapse border-spacing-0 text-[11px]">
                <thead className="sticky top-0 bg-white text-gray-600">
                  <tr>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Date
                    </th>
                    <th className="px-2 py-1 text-left font-medium">Title</th>
                    <th className="w-[80px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Instance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eventsSorted.map((row) => {
                    const ev = row.event;
                    const isSelected = selectedEventId === ev.id;
                    const hasInstance = !!row.instance_id;

                    return (
                      <tr
                        key={ev.id || `${ev.date || ""}_${ev.title || ""}`}
                        className={
                          "cursor-pointer border-b border-gray-100 bg-gray-50 text-gray-800 hover:bg-blue-50" +
                          (isSelected ? " bg-blue-50" : "")
                        }
                        onClick={() => {
                          setSelectedEventId(ev.id || null);
                          if (row.instance_id) {
                            setSelectedInstanceId(row.instance_id);
                          }
                        }}
                      >
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[11px] text-gray-900">
                            {ev.date || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="text-[11px] font-medium text-gray-900">
                            {ev.title || "(no title)"}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-gray-500">
                            {ev.category && (
                              <span className="inline-flex rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100">
                                {ev.category}
                              </span>
                            )}
                            {Array.isArray(ev.tags) &&
                              ev.tags
                                .filter((t) => t.startsWith("process:"))
                                .map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex rounded-full border border-gray-300 px-2 py-0.5 text-[10px]"
                                  >
                                    {t}
                                  </span>
                                ))}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          {renderEventStatusBadge(ev.status)}
                        </td>
                        <td className="px-2 py-1 align-top">
                          {hasInstance ? (
                            <div className="space-y-0.5 text-[10px]">
                              <div className="font-mono text-gray-900">
                                {row.instance_id}
                              </div>
                              <div>{renderInstanceStatusBadge(row.instance_status || undefined)}</div>
                              <div className="text-gray-500">
                                steps:{" "}
                                {row.instance_steps_count ?? "n/a"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              no instance
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {eventsSorted.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-3 text-center text-[11px] text-gray-500"
                      >
                        No events for selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Middle: instances */}
        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 border-b border-gray-100 pb-1">
            <h2 className="text-sm font-semibold text-gray-800">
              Process instances
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Internal process instances created from control events. Select an
              instance to see its steps on the right.
            </p>
          </div>

          {overview && instancesSorted.length === 0 && (
            <div className="flex-1 px-2 py-4 text-xs text-gray-500">
              No process instances for this period yet.
            </div>
          )}

          {overview && instancesSorted.length > 0 && (
            <div className="flex-1 overflow-auto rounded border border-gray-200 bg-gray-50">
              <table className="min-w-full border-collapse border-spacing-0 text-[11px]">
                <thead className="sticky top-0 bg-white text-gray-600">
                  <tr>
                    <th className="w-[90px] px-2 py-1 text-left font-medium">
                      Instance
                    </th>
                    <th className="px-2 py-1 text-left font-medium">Process</th>
                    <th className="w-[70px] px-2 py-1 text-left font-medium">
                      Period
                    </th>
                    <th className="w-[80px] px-2 py-1 text-left font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instancesSorted.map((inst) => {
                    const isSelected = selectedInstanceId === inst.id;
                    const stepCount = Array.isArray(inst.steps)
                      ? inst.steps.length
                      : 0;

                    return (
                      <tr
                        key={inst.id || "instance"}
                        className={
                          "cursor-pointer border-b border-gray-100 bg-gray-50 text-gray-800 hover:bg-blue-50" +
                          (isSelected ? " bg-blue-50" : "")
                        }
                        onClick={() => {
                          setSelectedInstanceId(inst.id || null);
                          setSelectedStepId(null);
                        }}
                      >
                        <td className="px-2 py-1 align-top">
                          <div className="font-mono text-[10px] text-gray-900">
                            {inst.id || "n/a"}
                          </div>
                          <div className="mt-0.5 text-[10px] text-gray-500">
                            client:{" "}
                            <span className="font-mono">
                              {inst.client_id || "n/a"}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="text-[11px] font-medium text-gray-900">
                            {inst.definition_name || inst.definition_id || "n/a"}
                          </div>
                          {inst.last_event_code && (
                            <div className="mt-0.5 text-[10px] text-gray-500">
                              last event:{" "}
                              <span className="font-mono">
                                {inst.last_event_code}
                              </span>
                            </div>
                          )}
                          <div className="mt-0.5 text-[10px] text-gray-500">
                            steps: {stepCount}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {inst.period || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          {renderInstanceStatusBadge(inst.status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: steps */}
        <section className="flex min-h-0 flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 border-b border-gray-100 pb-1">
            <h2 className="text-sm font-semibold text-gray-800">
              Steps of selected instance
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Technical steps of internal process lifecycle. This is a debug /
              observability view, not a user-facing checklist.
            </p>
          </div>

          {!selectedInstance && (
            <div className="flex-1 px-2 py-4 text-xs text-gray-500">
              Select a process instance in the middle column to see its steps.
            </div>
          )}

          {selectedInstance && (
            <>
              <div className="mb-2 text-[11px] text-gray-600">
                <div className="flex flex-wrap gap-3">
                  <span>
                    Instance:{" "}
                    <span className="font-mono text-gray-900">
                      {selectedInstance.id || "n/a"}
                    </span>
                  </span>
                  <span>
                    Client:{" "}
                    <span className="font-mono text-gray-900">
                      {selectedInstance.client_id || "n/a"}
                    </span>
                  </span>
                  <span>
                    Process:{" "}
                    <span className="font-mono text-gray-900">
                      {selectedInstance.definition_name ||
                        selectedInstance.definition_id ||
                        "n/a"}
                    </span>
                  </span>
                  <span>
                    Period:{" "}
                    <span className="font-mono text-gray-900">
                      {selectedInstance.period || "n/a"}
                    </span>
                  </span>
                  <span>
                    Status:{" "}
                    <span className="font-semibold text-gray-900">
                      {selectedInstance.status || "n/a"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded border border-gray-200 bg-gray-50">
                <table className="min-w-full border-collapse border-spacing-0 text-[11px]">
                  <thead className="sticky top-0 bg-white text-gray-600">
                    <tr>
                      <th className="w-[70px] px-2 py-1 text-left font-medium">
                        Step id
                      </th>
                      <th className="px-2 py-1 text-left font-medium">
                        Title
                      </th>
                      <th className="w-[80px] px-2 py-1 text-left font-medium">
                        Status
                      </th>
                      <th className="w-[110px] px-2 py-1 text-left font-medium">
                        Created
                      </th>
                      <th className="w-[110px] px-2 py-1 text-left font-medium">
                        Completed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stepsForSelectedInstance.map((step) => {
                      const key = step.id || step.title || "step";
                      const isSelected = selectedStepId === step.id;

                      return (
                        <tr
                          key={key}
                          className={
                            "cursor-pointer border-b border-gray-100 bg-gray-50 text-gray-800 hover:bg-blue-50" +
                            (isSelected ? " bg-blue-50" : "")
                          }
                          onClick={() => setSelectedStepId(step.id || null)}
                        >
                          <td className="px-2 py-1 align-top">
                            <span className="font-mono text-[10px] text-gray-900">
                              {step.id || "n/a"}
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <div className="text-[11px] font-medium text-gray-900">
                              {step.title || "(no title)"}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-top">
                            {renderStepStatusBadge(step.status)}
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
                      );
                    })}
                    {stepsForSelectedInstance.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-2 py-3 text-center text-[11px] text-gray-500"
                        >
                          No steps for this instance yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="mt-1 text-[11px] text-slate-300">
        <span className="mr-2">
          For raw JSON of all control events use{" "}
          <Link to="/internal-control-events-store" className="underline">
            Internal Control Events Store
          </Link>
          .
        </span>
        <span className="mr-2">
          For full internal processes lifecycle and task generation use{" "}
          <Link to="/internal-processes" className="underline">
            Internal Processes
          </Link>
          .
        </span>
        <span>
          For per-client control events and task suggestions use{" "}
          <Link to="/control-events" className="underline">
            Control Events
          </Link>
          .
        </span>
      </div>
    </div>
  );
};

export default ClientProcessOverviewPage;
