import React, { useEffect, useState } from "react";

type ControlEventTemplate = {
  type: string;
  code?: string;
  label?: string;
  category?: string;
  default_status?: string;
  [key: string]: any;
};

const InternalControlEventsStorePage: React.FC = () => {
  const [templates, setTemplates] = useState<ControlEventTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      setLoading(true);
      setError(null);

      try {
        const resp = await fetch("/api/internal/control-events-store-v2/");
        if (!resp.ok) {
          throw new Error("Failed to load templates: " + resp.status);
        }
        const data = (await resp.json()) as ControlEventTemplate[] | null;
        if (!isMounted) return;
        if (!data) {
          setTemplates([]);
        } else {
          const list = Array.isArray(data) ? data : [];
          list.sort((a, b) => {
            const ca = (a.category || "").toString().toLowerCase();
            const cb = (b.category || "").toString().toLowerCase();
            if (ca < cb) return -1;
            if (ca > cb) return 1;
            const ta = (a.type || "").toString().toLowerCase();
            const tb = (b.type || "").toString().toLowerCase();
            if (ta < tb) return -1;
            if (ta > tb) return 1;
            return 0;
          });
          setTemplates(list);
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

    loadTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">
          Internal control events store
        </h1>
        <p className="text-sm text-slate-600">
          Read-only view of control event templates inferred from control_events_store.json
          via /api/internal/control-events-store-v2/.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Failed to load templates: {error}
        </div>
      )}

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading control event templates...
        </div>
      )}

      {!loading && templates.length === 0 && !error && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Store is empty. No control event templates could be inferred from control_events_store.json.
        </div>
      )}

      {templates.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Templates
            </h2>
            <span className="text-xs text-slate-500">
              {templates.length} templates
            </span>
          </div>
          <div className="max-h-[480px] overflow-auto text-xs">
            <div className="grid grid-cols-5 gap-2 border-b border-slate-100 pb-1 font-medium text-slate-600">
              <div>Type</div>
              <div>Code</div>
              <div>Label</div>
              <div>Category</div>
              <div>Default status</div>
            </div>
            {templates.map((t) => (
              <div
                key={t.type}
                className="grid grid-cols-5 gap-2 border-b border-slate-100 py-1 last:border-b-0"
              >
                <div className="truncate" title={t.type}>
                  {t.type}
                </div>
                <div className="truncate" title={t.code || t.type}>
                  {t.code || t.type}
                </div>
                <div className="truncate" title={t.label || t.type}>
                  {t.label || t.type}
                </div>
                <div>{t.category || "general"}</div>
                <div>{t.default_status || "new"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalControlEventsStorePage;
