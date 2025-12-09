import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type EventZoomResponse = {
  event?: any;
  event_id?: string;
  client_id?: string;
  instance_id?: string;
  year?: number;
  month?: number;
  period?: string;
  [key: string]: any;
};

const ClientControlEventPage: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<EventZoomResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(`/api/internal/process-overview/event/${id}`);
        if (!resp.ok) {
          throw new Error("Load event: " + resp.status);
        }
        const json = (await resp.json()) as EventZoomResponse;
        setData(json);
      } catch (e: any) {
        setError(e?.message || "unknown error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const ev = data?.event ?? data;
  const clientId = data?.client_id;
  const instanceId = data?.instance_id;
  const period =
    data?.period ||
    (data?.year && data?.month
      ? `${data.year}-${String(data.month).padStart(2, "0")}`
      : undefined);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Control event details</h1>

      {id && (
        <div className="text-sm text-slate-700">
          Event id: <span className="font-mono">{id}</span>
        </div>
      )}

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-700 text-sm">Error: {error}</div>}

      {!loading && !error && data && (
        <div className="space-y-3 text-xs">
          <div className="border border-slate-200 bg-white rounded-md px-3 py-2">
            <div className="font-medium mb-1">Context</div>
            <div className="flex flex-wrap gap-4">
              <div>
                <div className="text-slate-500">Client</div>
                <div className="font-mono">{clientId || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500">Instance id</div>
                <div className="font-mono">{instanceId || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500">Period</div>
                <div className="font-mono">{period || "-"}</div>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-white rounded-md">
            <div className="border-b border-slate-200 px-3 py-2 font-medium">
              Event object
            </div>
            <div className="p-3 bg-slate-50 max-h-[600px] overflow-auto font-mono">
              <pre>{JSON.stringify(ev ?? {}, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="text-sm text-slate-700">No event data.</div>
      )}
    </div>
  );
};

export default ClientControlEventPage;
