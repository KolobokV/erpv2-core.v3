import React, { useEffect, useMemo, useState } from "react";

type ControlEvent = {
  id: string;
  client_id?: string | null;
  profile_code?: string | null;
  period?: string | null;
  event_code?: string | null;
  source?: string | null;
  status?: string | null;
  created_at?: string | null;
  payload?: any;
};

type FetchState<T> = {
  loading: boolean;
  error: string | null;
  items: T[];
};

const InternalControlEventsPage: React.FC = () => {
  const [clientFilter, setClientFilter] = useState<string>("");
  const [periodFilter, setPeriodFilter] = useState<string>("");

  const [state, setState] = useState<FetchState<ControlEvent>>({
    loading: false,
    error: null,
    items: [],
  });

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedEvent = useMemo<ControlEvent | null>(() => {
    if (!selectedEventId) return null;
    return state.items.find((e) => e.id === selectedEventId) ?? null;
  }, [selectedEventId, state.items]);

  const loadAllEvents = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const res = await fetch("/api/internal/control-events-store/");
      if (!res.ok) {
        throw new Error(`Failed to load events, status ${res.status}`);
      }

      const json = await res.json();
      const items = Array.isArray(json) ? json : json.items ?? [];
      setState({ loading: false, error: null, items });
      setSelectedEventId(items.length > 0 ? String(items[0].id) : null);
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || "Failed to load control events",
      }));
    }
  };

  const loadFilteredEvents = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const clientId = clientFilter.trim();
      const period = periodFilter.trim();

      let url = "/api/internal/control-events-store/";
      if (clientId) {
        const encodedClient = encodeURIComponent(clientId);
        const search = period ? `?period=${encodeURIComponent(period)}` : "";
        url = `/api/internal/control-events-store/client/${encodedClient}${search}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load events, status ${res.status}`);
      }

      const json = await res.json();
      const items = Array.isArray(json) ? json : json.items ?? [];
      setState({ loading: false, error: null, items });
      setSelectedEventId(items.length > 0 ? String(items[0].id) : null);
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || "Failed to load control events",
      }));
    }
  };

  useEffect(() => {
    loadAllEvents().catch(() => undefined);
  }, []);

  const { loading, error, items } = state;
  const hasItems = items.length > 0;

  const totalByStatus = useMemo(() => {
    let totalNew = 0;
    let totalHandled = 0;
    let totalError = 0;

    for (const ev of items) {
      const status = (ev.status || "").toLowerCase();
      if (!status || status === "new") {
        totalNew += 1;
      } else if (status === "handled") {
        totalHandled += 1;
      } else if (status === "error") {
        totalError += 1;
      }
    }

    return { totalNew, totalHandled, totalError };
  }, [items]);

  return (
    <div className="flex h-full flex-col p-4">
      <header className="mb-3 border-b border-gray-200 pb-2">
        <h1 className="text-base font-semibold text-gray-900">
          Control events store
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          Events created by reglament chains and stored in JSON backend store.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="mb-1 text-[11px] text-gray-600">
            Client id filter
          </label>
          <input
            type="text"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            placeholder="client_id (optional)"
            className="w-48 rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-[11px] text-gray-600">
            Period filter
          </label>
          <input
            type="text"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            placeholder="YYYY-MM (optional)"
            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>

        <button
          type="button"
          onClick={loadFilteredEvents}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Load with filters
        </button>

        <button
          type="button"
          onClick={loadAllEvents}
          className="rounded border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Load all
        </button>

        <div className="ml-auto flex flex-col items-end text-[11px] text-gray-500">
          <div>
            Total events:{" "}
            <span className="font-semibold text-gray-900">
              {items.length}
            </span>
          </div>
          <div className="mt-0.5 flex gap-3">
            <span>
              New:{" "}
              <span className="font-mono text-gray-900">
                {totalByStatus.totalNew}
              </span>
            </span>
            <span>
              Handled:{" "}
              <span className="font-mono text-gray-900">
                {totalByStatus.totalHandled}
              </span>
            </span>
            <span>
              Error:{" "}
              <span className="font-mono text-gray-900">
                {totalByStatus.totalError}
              </span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-sm font-semibold text-gray-800">
              Events
            </h2>
            {loading && (
              <span className="text-[11px] text-gray-500">
                Loading...
              </span>
            )}
          </div>

          {!hasItems ? (
            <div className="flex-1 px-3 py-4 text-xs text-gray-500">
              No events found. Trigger reglament chains or use filters.
            </div>
          ) : (
            <div className="mt-2 min-h-0 flex-1 overflow-auto">
              <table className="min-w-full border-separate border-spacing-y-1 text-xs">
                <thead className="text-[11px] text-gray-500">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">
                      Created
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Client
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Profile
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Period
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Code
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Status
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Source
                    </th>
                    <th className="px-2 py-1 text-left font-medium">
                      Payload
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ev) => {
                    const isSelected = selectedEventId === ev.id;
                    const created = ev.created_at || "";

                    const status = (ev.status || "").toLowerCase();
                    let statusLabel = ev.status || "new";
                    let statusClasses =
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ";

                    if (status === "handled") {
                      statusClasses +=
                        "border-green-200 bg-green-50 text-green-700";
                    } else if (status === "error") {
                      statusClasses +=
                        "border-red-200 bg-red-50 text-red-700";
                    } else {
                      statusClasses +=
                        "border-gray-200 bg-gray-50 text-gray-700";
                    }

                    const shortPayload = (() => {
                      try {
                        if (!ev.payload) return "";
                        const raw = JSON.stringify(ev.payload);
                        if (raw.length > 80) {
                          return raw.slice(0, 77) + "...";
                        }
                        return raw;
                      } catch {
                        return "";
                      }
                    })();

                    return (
                      <tr
                        key={ev.id}
                        className={
                          "cursor-pointer rounded-md bg-gray-50 text-[11px] text-gray-800 hover:bg-blue-50" +
                          (isSelected ? " bg-blue-50" : "")
                        }
                        onClick={() => setSelectedEventId(ev.id)}
                      >
                        <td className="px-2 py-1 align-top">
                          <div className="font-mono text-[10px] text-gray-800">
                            {created}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="font-mono text-[11px] text-gray-900">
                            {ev.client_id || "n/a"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {ev.profile_code || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {ev.period || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {ev.event_code || "n/a"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className={statusClasses}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="font-mono text-[10px] text-gray-800">
                            {ev.source || "chain"}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="max-w-[260px] text-[10px] text-gray-600">
                            {shortPayload || "(empty payload)"}
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

        <section className="flex min-h-0 w-[340px] flex-col rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
          <div className="mb-2 border-b border-gray-100 pb-1">
            <h2 className="text-sm font-semibold text-gray-800">
              Selected event payload
            </h2>
            {selectedEvent && (
              <div className="mt-1 text-[11px] text-gray-600">
                <span className="mr-2">
                  Client:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedEvent.client_id || "n/a"}
                  </span>
                </span>
                <span className="mr-2">
                  Period:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedEvent.period || "n/a"}
                  </span>
                </span>
                <span className="mr-2">
                  Code:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedEvent.event_code || "n/a"}
                  </span>
                </span>
                <span>
                  Status:{" "}
                  <span className="font-mono text-gray-900">
                    {selectedEvent.status || "new"}
                  </span>
                </span>
              </div>
            )}
          </div>

          {!selectedEvent ? (
            <div className="flex-1 px-2 py-3 text-xs text-gray-500">
              Select an event on the left to inspect its payload.
            </div>
          ) : (
            <pre className="min-h-0 flex-1 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-800">
              {JSON.stringify(selectedEvent.payload ?? {}, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
};

export default InternalControlEventsPage;
