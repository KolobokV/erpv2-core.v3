import React, { useEffect, useMemo, useState } from "react";

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
        const data = ((async () => {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const t = await resp.text();
      if (!t) return null;
      return JSON.parse(t);
    })()) as ControlEventTemplate[] | null;
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
            const coa = (a.code || "").toString().toLowerCase();
            const cob = (b.code || "").toString().toLowerCase();
            if (coa < cob) return -1;
            if (coa > cob) return 1;
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

  const stats = useMemo(() => {
    const total = templates.length;
    const categoriesSet = new Set<string>();
    let defaultNew = 0;
    let defaultDone = 0;

    for (const t of templates) {
      if (t.category) {
        categoriesSet.add(String(t.category));
      }
      const st = (t.default_status || "").toLowerCase();
      if (st === "new") defaultNew += 1;
      if (st === "done" || st === "completed" || st === "closed") {
        defaultDone += 1;
      }
    }

    return {
      total,
      categories: categoriesSet.size,
      defaultNew,
      defaultDone,
    };
  }, [templates]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-900">
          Internal control events store
        </h1>
        <p className="text-sm text-slate-600">
          Read-only view of control event templates from /api/internal/control-events-store-v2/.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <div className="text-slate-500">Total templates</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.total}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <div className="text-slate-500">Categories</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {stats.categories}
          </div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-sky-700">Default status: new</div>
          <div className="mt-1 text-lg font-semibold text-sky-900">
            {stats.defaultNew}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs shadow-sm">
          <div className="text-emerald-700">Default status: done</div>
          <div className="mt-1 text-lg font-semibold text-emerald-900">
            {stats.defaultDone}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Loading templates...
        </div>
      )}

      {!loading && templates.length === 0 && !error && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No templates loaded from /api/internal/control-events-store-v2/.
        </div>
      )}

      {templates.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Templates list
            </h2>
            <span className="text-xs text-slate-500">
              {templates.length} templates
            </span>
          </div>
          <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-100 text-xs">
            <div className="grid grid-cols-5 gap-2 border-b border-slate-100 bg-slate-50 px-2 py-1 font-medium text-slate-600">
              <div>Category</div>
              <div>Type</div>
              <div>Code</div>
              <div>Label</div>
              <div>Default status</div>
            </div>
            {templates.map((t, index) => {
              const rowStripe = index % 2 === 0 ? "bg-white" : "bg-slate-50/40";
              return (
                <div
                  key={(t.code || t.type || index).toString()}
                  className={
                    "grid grid-cols-5 items-center gap-2 border-b border-slate-100 px-2 py-1 " +
                    rowStripe
                  }
                >
                  <div className="truncate">
                    {t.category || "general"}
                  </div>
                  <div className="truncate">
                    {t.type}
                  </div>
                  <div className="truncate">
                    {t.code || "-"}
                  </div>
                  <div className="truncate">
                    {t.label || t.type}
                  </div>
                  <div className="truncate">
                    {t.default_status || "new"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalControlEventsStorePage;
