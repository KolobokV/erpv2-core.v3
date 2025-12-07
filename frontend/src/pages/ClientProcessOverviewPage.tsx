import React, { useEffect, useState } from "react";

const CLIENT_PROFILE_FOCUS_KEY = "erpv2_client_profile_focus";

type ControlEvent = {
  id: string;
  client_id: string;
  profile_code?: string;
  period?: string;
  event_code?: string;
  date?: string;
  title?: string;
  status?: string;
  category?: string;
  source?: string;
};

type InstanceStep = {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  completed_at?: string;
};

type ProcessInstance = {
  id: string;
  client_id: string;
  profile_code?: string;
  period?: string;
  status?: string;
  computed_status?: string;
  source?: string;
  events?: string[];
  steps?: InstanceStep[];
  created_at?: string;
  updated_at?: string;
};

type EventWithInstanceLink = {
  event: ControlEvent;
  instance_id?: string | null;
  instance_status?: string | null;
  instance_steps_count?: number | null;
};

type ProcessOverviewPayload = {
  client_id: string;
  year: number;
  month: number;
  period: string;
  events: EventWithInstanceLink[];
  instances: ProcessInstance[];
};

function getDefaultClientId(): string {
  try {
    const raw = window.localStorage.getItem(CLIENT_PROFILE_FOCUS_KEY);
    if (!raw) {
      return "ip_usn_dr";
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return "ip_usn_dr";
    }

    // try JSON payload { clientId: "..." }
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed &&
        typeof parsed.clientId === "string" &&
        parsed.clientId.trim().length > 0
      ) {
        return parsed.clientId.trim();
      }
    } catch {
      // not JSON, fall back to raw string
    }

    return trimmed;
  } catch {
    return "ip_usn_dr";
  }
}

function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function formatYearMonth(year: number, month: number): string {
  const mm = month < 10 ? `0${month}` : String(month);
  return `${year}-${mm}`;
}

function getInstanceDisplayStatus(instance: ProcessInstance): string {
  if (instance.computed_status && instance.computed_status.trim().length > 0) {
    return instance.computed_status;
  }
  if (instance.status && instance.status.trim().length > 0) {
    return instance.status;
  }
  return "open";
}

function getInstanceStatusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return "#10b981"; // green
  }
  if (normalized === "waiting") {
    return "#f59e0b"; // orange
  }
  if (normalized === "error" || normalized === "failed") {
    return "#ef4444"; // red
  }
  return "#3b82f6"; // blue
}

function getStepStatusColor(status: string): string {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed") {
    return "#10b981";
  }
  if (normalized === "error" || normalized === "failed") {
    return "#ef4444";
  }
  return "#64748b";
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "12px",
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  minHeight: 0,
};

const columnHeaderStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#64748b",
};

const badgeStyleBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 500,
  backgroundColor: "#e5e7eb",
  color: "#374151",
};

const listContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  overflowY: "auto",
  paddingRight: "4px",
};

const listItemStyleBase: React.CSSProperties = {
  borderRadius: "8px",
  padding: "6px 8px",
  cursor: "pointer",
  border: "1px solid transparent",
};

const listItemSelectedBorder = "#3b82f6";
const listItemSelectedBg = "#eff6ff";

export const ClientProcessOverviewPage: React.FC = () => {
  const initial = getCurrentYearMonth();

  const [clientId, setClientId] = useState<string>(getDefaultClientId);
  const [year, setYear] = useState<number>(initial.year);
  const [month, setMonth] = useState<number>(initial.month);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<ProcessOverviewPayload | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/internal/process-overview/client/${encodeURIComponent(
          clientId,
        )}?year=${year}&month=${month}`;
        const resp = await fetch(url, { signal: abort.signal });
        if (!resp.ok) {
          throw new Error(`Request failed with status ${resp.status}`);
        }
        const data = (await resp.json()) as ProcessOverviewPayload;
        setOverview(data);

        let newSelectedInstanceId: string | null = null;
        let newSelectedEventId: string | null = null;

        if (data.events && data.events.length > 0) {
          const first = data.events[0];
          newSelectedEventId = first.event.id;
          if (first.instance_id) {
            newSelectedInstanceId = first.instance_id;
          }
        }

        if (!newSelectedInstanceId && data.instances && data.instances.length > 0) {
          newSelectedInstanceId = data.instances[0].id;
        }

        setSelectedInstanceId((prev) => prev ?? newSelectedInstanceId);
        setSelectedEventId((prev) => prev ?? newSelectedEventId);
      } catch (err: any) {
        if (err.name === "AbortError") {
          return;
        }
        setError(err?.message || "Failed to load client process overview");
      } finally {
        setLoading(false);
      }
    };

    load().catch(() => undefined);

    return () => {
      abort.abort();
    };
  }, [clientId, year, month]);

  const currentPeriod = formatYearMonth(year, month);

  const events = overview?.events ?? [];
  const instances = overview?.instances ?? [];

  const selectedInstance: ProcessInstance | undefined = instances.find(
    (inst) => inst.id === selectedInstanceId,
  );

  const steps: InstanceStep[] = selectedInstance?.steps ?? [];

  const handleClientIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setClientId(value);
    setSelectedInstanceId(null);
    setSelectedEventId(null);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) {
      setYear(v);
      setSelectedInstanceId(null);
      setSelectedEventId(null);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number.parseInt(e.target.value, 10);
    if (!Number.isNaN(v) && v >= 1 && v <= 12) {
      setMonth(v);
      setSelectedInstanceId(null);
      setSelectedEventId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">
          Client process overview
        </h1>
        <p className="text-xs text-slate-600 max-w-2xl">
          Combined view of control events, process instances, and steps for a
          single client and period. Use this to understand how well the
          regulatory workflow is covered by processes.
        </p>
      </header>

      <section className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col text-xs">
          <label className="mb-1 font-medium text-slate-700">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={handleClientIdChange}
            className="border border-slate-300 rounded px-2 py-1 text-xs font-mono"
            placeholder="ip_usn_dr"
          />
        </div>

        <div className="flex flex-col text-xs w-20">
          <label className="mb-1 font-medium text-slate-700">Year</label>
          <input
            type="number"
            value={year}
            onChange={handleYearChange}
            className="border border-slate-300 rounded px-2 py-1 text-xs"
          />
        </div>

        <div className="flex flex-col text-xs w-20">
          <label className="mb-1 font-medium text-slate-700">Month</label>
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={handleMonthChange}
            className="border border-slate-300 rounded px-2 py-1 text-xs"
          />
        </div>

        <div className="text-xs text-slate-500">
          <div>Period: {currentPeriod}</div>
          {overview && (
            <div>
              Loaded for:{" "}
              <span className="font-mono">
                {overview.client_id} / {overview.period}
              </span>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-xs text-slate-500">Loading overview...</div>
        )}
        {error && (
          <div className="text-xs text-red-500">
            Error: <span className="font-mono">{error}</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Events column */}
        <div style={cardStyle}>
          <div style={columnHeaderStyle}>Control events</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Events generated by reglament chains for this client and period.
          </div>
          <div style={{ marginTop: "6px", ...listContainerStyle }}>
            {events.length === 0 && (
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                No control events found.
              </div>
            )}
            {events.map((item) => {
              const ev = item.event;
              const isSelected = ev.id === selectedEventId;
              const hasInstance = !!item.instance_id;
              const baseStyle: React.CSSProperties = {
                ...listItemStyleBase,
                borderColor: isSelected ? listItemSelectedBorder : "transparent",
                backgroundColor: isSelected ? listItemSelectedBg : "transparent",
              };

              return (
                <div
                  key={ev.id}
                  style={baseStyle}
                  onClick={() => {
                    setSelectedEventId(ev.id);
                    if (item.instance_id) {
                      setSelectedInstanceId(item.instance_id);
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#111827",
                      }}
                    >
                      {ev.title || ev.event_code || "(no title)"}
                    </div>
                    {hasInstance && (
                      <span
                        style={{
                          ...badgeStyleBase,
                          backgroundColor: "#ecfdf5",
                          color: "#16a34a",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        linked
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "11px",
                      color: "#6b7280",
                    }}
                  >
                    {ev.date && (
                      <span style={{ marginRight: "6px" }}>
                        {ev.date} •{" "}
                        <span className="font-mono">
                          {ev.event_code || "event"}
                        </span>
                      </span>
                    )}
                    {ev.status && (
                      <span className="font-mono text-[11px]">
                        status: {ev.status}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "11px",
                      color: "#9ca3af",
                    }}
                  >
                    src: <span>{ev.source || "reglament"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Instances column */}
        <div style={cardStyle}>
          <div style={columnHeaderStyle}>Process instances</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Instances built from control events, one per client/profile/period.
          </div>
          <div style={{ marginTop: "6px", ...listContainerStyle }}>
            {instances.length === 0 && (
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                No process instances for this client and period.
              </div>
            )}
            {instances.map((inst) => {
              const isSelected = inst.id === selectedInstanceId;
              const instanceStatus = getInstanceDisplayStatus(inst);
              const badgeColor = getInstanceStatusColor(instanceStatus);
              const stepCount = inst.steps ? inst.steps.length : 0;

              const baseStyle: React.CSSProperties = {
                ...listItemStyleBase,
                borderColor: isSelected ? listItemSelectedBorder : "transparent",
                backgroundColor: isSelected ? listItemSelectedBg : "transparent",
              };

              return (
                <div
                  key={inst.id}
                  style={baseStyle}
                  onClick={() => setSelectedInstanceId(inst.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#111827",
                      }}
                    >
                      {inst.profile_code || "process"} •{" "}
                      {inst.period || currentPeriod}
                    </div>
                    <span
                      style={{
                        ...badgeStyleBase,
                        backgroundColor: "#eff6ff",
                        color: badgeColor,
                        border: `1px solid ${badgeColor}`,
                      }}
                    >
                      {instanceStatus}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "11px",
                      color: "#6b7280",
                    }}
                  >
                    steps:{" "}
                    <span style={{ fontWeight: 500 }}>{stepCount}</span>
                    {inst.events && inst.events.length > 0 && (
                      <span style={{ marginLeft: "6px" }}>
                        events:{" "}
                        <span style={{ fontWeight: 500 }}>
                          {inst.events.length}
                        </span>
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: "2px",
                      fontSize: "11px",
                      color: "#9ca3af",
                    }}
                  >
                    id: <span>{inst.id}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Steps column */}
        <div style={cardStyle}>
          <div style={columnHeaderStyle}>Process steps</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>
            Steps for the selected process instance.
          </div>
          <div style={{ marginTop: "6px", ...listContainerStyle }}>
            {!selectedInstance && (
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                Select an instance to see its steps.
              </div>
            )}
            {selectedInstance && steps.length === 0 && (
              <div style={{ fontSize: "12px", color: "#9ca3af" }}>
                This instance has no steps yet.
              </div>
            )}
            {selectedInstance &&
              steps.length > 0 &&
              steps.map((step) => {
                const color = getStepStatusColor(step.status);
                return (
                  <div
                    key={step.id}
                    style={{
                      ...listItemStyleBase,
                      cursor: "default",
                      borderColor: "transparent",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#111827",
                        }}
                      >
                        {step.title}
                      </div>
                      <span
                        style={{
                          ...badgeStyleBase,
                          backgroundColor: "#f9fafb",
                          color: color,
                          border: `1px solid ${color}`,
                        }}
                      >
                        {step.status || "pending"}
                      </span>
                    </div>
                    {(step.created_at || step.completed_at) && (
                      <div
                        style={{
                          marginTop: "2px",
                          fontSize: "11px",
                          color: "#9ca3af",
                        }}
                      >
                        {step.created_at && (
                          <span style={{ marginRight: "6px" }}>
                            created: {step.created_at}
                          </span>
                        )}
                        {step.completed_at && (
                          <span>completed: {step.completed_at}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProcessOverviewPage;
