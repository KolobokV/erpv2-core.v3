import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type ClientProfile = {
  id: string;
  label: string;
  short_label?: string;
};

type ProcessStep = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  type?: string;
  due_date?: string;
  [key: string]: any;
};

type ProcessInstance = {
  id: string;
  client_id: string;
  label?: string;
  year?: number;
  month?: number;
  period?: string;
  status?: string;
  steps?: ProcessStep[];
  [key: string]: any;
};

type ControlEvent = {
  id: string;
  client_id: string;
  instance_id?: string;
  name?: string;
  title?: string;
  type?: string;
  due_date?: string;
  year?: number;
  month?: number;
  period?: string;
  status?: string;
  [key: string]: any;
};

type InstancesResponse = {
  clients?: ClientProfile[];
  instances?: ProcessInstance[];
};

function makePeriod(year: number, month: number): string {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

function matchPeriod(obj: any, year: number, month: number): boolean {
  if (!obj) {
    return false;
  }

  const targetPeriod = makePeriod(year, month);

  if (obj.period === targetPeriod) {
    return true;
  }

  const oy = obj.year;
  const om = obj.month;

  if (oy == null || om == null) {
    return false;
  }

  const omInt = typeof om === "string" ? parseInt(om, 10) : om;
  return Number(oy) === Number(year) && Number(omInt) === Number(month);
}

const ClientProcessOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [events, setEvents] = useState<ControlEvent[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [year, setYear] = useState<number>(2025);
  const [month, setMonth] = useState<number>(12);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load base data (clients, instances, events) once
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [clientsResp, instancesResp, eventsResp] = await Promise.all([
          fetch("/api/internal/client-profiles"),
          fetch("/api/internal/process-instances-v2/"),
          fetch("/api/internal/control-events-store/"),
        ]);

        if (!clientsResp.ok) {
          throw new Error("Failed to load client profiles");
        }

        if (!instancesResp.ok) {
          throw new Error("Failed to load process instances");
        }

        if (!eventsResp.ok) {
          throw new Error("Failed to load control events store");
        }

        const clientsJson: any = await clientsResp.json();
        const instancesJson = (await instancesResp.json()) as InstancesResponse;
        const eventsJson = (await eventsResp.json()) as ControlEvent[];

        // Normalize clients shape: support array and { clients: [...] }
        let normalizedClients: ClientProfile[] = [];
        if (Array.isArray(clientsJson)) {
          normalizedClients = clientsJson;
        } else if (clientsJson && Array.isArray(clientsJson.clients)) {
          normalizedClients = clientsJson.clients;
        }

        setClients(normalizedClients);
        const allInstances = instancesJson.instances || [];
        setInstances(allInstances);
        setEvents(eventsJson || []);

        if (!selectedClientId && normalizedClients.length > 0) {
          setSelectedClientId(normalizedClients[0].id);
        }
      } catch (e: any) {
        console.error("Error loading client process overview data:", e);
        setError(e?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentClient = useMemo(
    () =>
      Array.isArray(clients)
        ? clients.find((c) => c.id === selectedClientId) || null
        : null,
    [clients, selectedClientId]
  );

  const currentInstance = useMemo(() => {
    if (!selectedClientId || !Array.isArray(instances)) {
      return null;
    }
    const forClient = instances.filter(
      (inst) => String(inst.client_id) === String(selectedClientId)
    );
    if (forClient.length === 0) {
      return null;
    }

    const exact = forClient.find((inst) => matchPeriod(inst, year, month));
    if (exact) {
      return exact;
    }

    return forClient[forClient.length - 1];
  }, [instances, selectedClientId, year, month]);

  const currentSteps = useMemo<ProcessStep[]>(() => {
    if (!currentInstance || !Array.isArray(currentInstance.steps)) {
      return [];
    }
    return currentInstance.steps as ProcessStep[];
  }, [currentInstance]);

  const currentEvents = useMemo<ControlEvent[]>(() => {
    if (!selectedClientId || !Array.isArray(events)) {
      return [];
    }
    return events.filter(
      (ev) =>
        String(ev.client_id) === String(selectedClientId) &&
        matchPeriod(ev, year, month)
    );
  }, [events, selectedClientId, year, month]);

  const meta = useMemo(
    () => ({
      client_id: selectedClientId || null,
      client_label: currentClient ? currentClient.label : null,
      year,
      month,
      period: makePeriod(year, month),
      instance_id: currentInstance ? currentInstance.id : null,
      instance_period: currentInstance ? currentInstance.period : null,
      steps_count: currentSteps.length,
      control_events_count: currentEvents.length,
    }),
    [selectedClientId, currentClient, year, month, currentInstance, currentSteps, currentEvents]
  );

  function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedClientId(e.target.value);
  }

  function handleYearChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) {
      setYear(v);
    }
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) {
      setMonth(v);
    }
  }

  function handleStepClick(step: ProcessStep) {
    if (!step.id) {
      return;
    }
    navigate(`/client-process-overview/step/${step.id}`);
  }

  function handleEventClick(event: ControlEvent) {
    if (!event.id) {
      return;
    }
    navigate(`/client-process-overview/event/${event.id}`);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold mb-2">Client process overview</h1>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Client</label>
          <select
            className="border rounded px-2 py-1 min-w-[240px]"
            value={selectedClientId}
            onChange={handleClientChange}
          >
            <option value="">Select client</option>
            {Array.isArray(clients) &&
              clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short_label || c.label || c.id}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Year</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-24"
            value={year}
            onChange={handleYearChange}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Month</label>
          <input
            type="number"
            className="border rounded px-2 py-1 w-20"
            value={month}
            min={1}
            max={12}
            onChange={handleMonthChange}
          />
        </div>

        {loading && <div className="text-sm text-gray-500">Loading...</div>}
        {error && <div className="text-sm text-red-600">Error: {error}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Instance block */}
        <div className="border rounded p-3 bg-white">
          <h2 className="font-semibold mb-2">Instance</h2>
          {!selectedClientId && (
            <div className="text-sm text-gray-500">
              Select client to see instance.
            </div>
          )}
          {selectedClientId && !currentInstance && (
            <div className="text-sm text-gray-500">
              No instance found for this client and period.
            </div>
          )}
          {currentInstance && (
            <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-64">
              {JSON.stringify(currentInstance, null, 2)}
            </pre>
          )}
        </div>

        {/* Steps block */}
        <div className="border rounded p-3 bg-white">
          <h2 className="font-semibold mb-2">
            Steps ({currentSteps.length})
          </h2>
          {currentSteps.length === 0 && (
            <div className="text-sm text-gray-500">
              No steps for this client and period.
            </div>
          )}
          {currentSteps.length > 0 && (
            <div className="border rounded max-h-64 overflow-auto text-xs">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border px-2 py-1 text-left">Name</th>
                    <th className="border px-2 py-1 text-left">Status</th>
                    <th className="border px-2 py-1 text-left">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSteps.map((step) => (
                    <tr
                      key={step.id || step.name}
                      className="hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleStepClick(step)}
                    >
                      <td className="border px-2 py-1">
                        {step.title || step.name || step.id}
                      </td>
                      <td className="border px-2 py-1">
                        {step.status || step.type || ""}
                      </td>
                      <td className="border px-2 py-1">
                        {step.due_date || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Control events block */}
        <div className="border rounded p-3 bg-white">
          <h2 className="font-semibold mb-2">
            Control events ({currentEvents.length})
          </h2>
          {currentEvents.length === 0 && (
            <div className="text-sm text-gray-500">
              No control events for this client and period.
            </div>
          )}
          {currentEvents.length > 0 && (
            <div className="border rounded max-h-64 overflow-auto text-xs">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border px-2 py-1 text-left">Name</th>
                    <th className="border px-2 py-1 text-left">Status</th>
                    <th className="border px-2 py-1 text-left">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEvents.map((ev) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleEventClick(ev)}
                    >
                      <td className="border px-2 py-1">
                        {ev.title || ev.name || ev.id}
                      </td>
                      <td className="border px-2 py-1">
                        {ev.status || ev.type || ""}
                      </td>
                      <td className="border px-2 py-1">
                        {ev.due_date || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="border rounded p-3 bg-white">
        <h2 className="font-semibold mb-2">Meta</h2>
        <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto max-h-40">
          {JSON.stringify(meta, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default ClientProcessOverviewPage;
