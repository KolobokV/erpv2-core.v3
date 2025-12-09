import React, { useEffect, useState } from "react";

type ControlEventTemplate = {
  id?: string;
  code?: string;
  label?: string;
  description?: string;
  category?: string;
  default_status?: string;
  is_active?: boolean;
  [key: string]: any;
};

function toList(data: any): ControlEventTemplate[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.templates)) return data.templates;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

const InternalControlEventsStorePage: React.FC = () => {
  const [items, setItems] = useState<ControlEventTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch("/api/internal/control-events-store/");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json = await r.json();
        if (!mounted) return;
        const list = toList(json);
        list.sort((a, b) => {
          const ca = (a.code || "").toString();
          const cb = (b.code || "").toString();
          return ca.localeCompare(cb);
        });
        setItems(list);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Internal control events store</h1>
      <p className="text-xs text-slate-600">
        Read-only view of control event templates loaded from control_events_templates_store.json.
      </p>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-700 text-xs">Error: {error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="text-sm">
          Store is empty. Define control event templates in control_events_templates_store.json.
        </div>
      )}

      {items.length > 0 && (
        <div className="text-xs border rounded-md bg-white overflow-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Label</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Default status</th>
                <th className="px-3 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tpl, idx) => (
                <tr key={tpl.id || tpl.code || idx} className="border-t">
                  <td className="px-3 py-2 font-mono">{tpl.code || "-"}</td>
                  <td className="px-3 py-2">{tpl.label || "-"}</td>
                  <td className="px-3 py-2">{tpl.category || "-"}</td>
                  <td className="px-3 py-2">{tpl.default_status || "-"}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <div className="truncate" title={tpl.description || ""}>
                      {tpl.description || "-"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InternalControlEventsStorePage;
