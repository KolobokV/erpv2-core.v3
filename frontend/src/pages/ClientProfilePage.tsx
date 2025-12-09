import React, { useEffect, useState } from "react";

type ClientProfile = {
  client_id?: string;
  label?: string;
  name?: string;
  tax_system?: string;
  regime?: string;
  features?: any;
  payment_dates?: any;
  meta?: any;
  [key: string]: any;
};

type ProfilesResponse =
  | ClientProfile[]
  | {
      items?: ClientProfile[];
      clients?: ClientProfile[];
      [key: string]: any;
    }
  | null
  | undefined;

function extractProfiles(data: ProfilesResponse): ClientProfile[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray((data as any).items)) return (data as any).items as ClientProfile[];
  if (Array.isArray((data as any).clients)) return (data as any).clients as ClientProfile[];
  return [];
}

const ClientProfilePage: React.FC = () => {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [selected, setSelected] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch("/api/internal/client-profiles");
        if (!resp.ok) {
          throw new Error("Failed to load client profiles: " + resp.status);
        }
        const json: ProfilesResponse = await resp.json();
        const list = extractProfiles(json);
        list.sort((a, b) => {
          const la = (a.label || a.name || a.client_id || "").toString();
          const lb = (b.label || b.name || b.client_id || "").toString();
          return la.localeCompare(lb);
        });
        if (isMounted) {
          setProfiles(list);
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
        <h1 className="text-xl font-semibold mb-1">Client profiles</h1>
        <p className="text-sm text-slate-600">
          Read-only list of internal client profiles from /api/internal/client-profiles.
        </p>
      </div>

      {loading && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          Loading client profiles...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Error: {error}
        </div>
      )}

      {!loading && !error && profiles.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          No client profiles found.
        </div>
      )}

      {profiles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-200 bg-white text-xs">
            <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">
                Clients ({profiles.length})
              </span>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Tax system</th>
                    <th className="px-3 py-2">Regime</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p, idx) => {
                    const isSelected = selected === p;
                    const label = p.label || p.name || p.client_id || "-";
                    const tax = p.tax_system || p.regime || "-";
                    const regime = p.regime || "-";
                    return (
                      <tr
                        key={p.client_id || idx}
                        className={
                          "cursor-pointer border-t border-slate-100 " +
                          (isSelected ? "bg-emerald-50" : "hover:bg-slate-50")
                        }
                        onClick={() => setSelected(p)}
                      >
                        <td className="px-3 py-2 text-slate-800">
                          <div className="font-medium truncate max-w-[220px]" title={label}>
                            {label}
                          </div>
                          {p.client_id && (
                            <div className="text-[10px] text-slate-500">{p.client_id}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{tax}</td>
                        <td className="px-3 py-2 text-slate-700">{regime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-3 py-2">
              <span className="text-sm font-medium text-slate-800">
                Selected profile details
              </span>
            </div>
            <div className="p-3 text-xs font-mono bg-slate-50 max-h-[520px] overflow-auto">
              {selected ? (
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              ) : (
                <span className="text-slate-600">No client selected.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfilePage;
