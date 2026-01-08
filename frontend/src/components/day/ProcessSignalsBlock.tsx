import React, { useEffect, useMemo, useState } from "react";
import { t } from "../../i18n/t";

type Proc = {
  id?: string;
  key?: string;
  label?: string;
  client_id?: string;
  status?: string;
  updated_at?: string;
};

function normalizeList(raw: any): Proc[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function classifyStatus(p: Proc): "active" | "pending" | "blocked" | "completed" | "other" {
  const s = (p.status || "").toLowerCase();
  if (s.includes("run") || s.includes("active")) return "active";
  if (s.includes("wait") || s.includes("pend")) return "pending";
  if (s.includes("block") || s.includes("error") || s.includes("fail")) return "blocked";
  if (s.includes("complete") || s.includes("done")) return "completed";
  return "other";
}

function pill(kind: string): JSX.Element {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs border";
  if (kind === "active") return <span className={base + " border-emerald-200 bg-emerald-50 text-emerald-800"}>{t("signals.active")}</span>;
  if (kind === "pending") return <span className={base + " border-sky-200 bg-sky-50 text-sky-800"}>{t("signals.pending")}</span>;
  if (kind === "blocked") return <span className={base + " border-red-200 bg-red-50 text-red-700"}>{t("signals.blocked")}</span>;
  if (kind === "completed") return <span className={base + " border-slate-200 bg-slate-50 text-slate-600"}>{t("signals.completed")}</span>;
  return <span className={base + " border-slate-200 bg-slate-50 text-slate-700"}>{t("signals.other")}</span>;
}

export default function ProcessSignalsBlock() {
  const [items, setItems] = useState<Proc[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/internal/process-instances");
        if (!res.ok) throw new Error("fetch_failed");
        const data = await res.json();
        setItems(normalizeList(data));
      } catch {
        setError(t("signals.failed"));
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const groups = useMemo(() => {
    const map: Record<string, Proc[]> = {
      active: [],
      pending: [],
      blocked: [],
      completed: [],
      other: [],
    };
    for (const p of items) {
      const k = classifyStatus(p);
      map[k].push(p);
    }
    return map;
  }, [items]);

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">
        {t("signals.loading")}
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-slate-200 p-4 text-sm text-red-600">
        {error}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-slate-500">
            {t("signals.title")}
          </h2>
          <div className="text-xs text-slate-400">
            {t("signals.active")}: {groups.active.length}, {t("signals.pending")}: {groups.pending.length}, {t("signals.blocked")}: {groups.blocked.length}
          </div>
        </div>

        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
          onClick={() => setShowCompleted((v) => !v)}
        >
          {showCompleted ? t("common.hideCompleted") : t("common.showCompleted")}
        </button>
      </div>

      {(["active", "pending", "blocked", "other", "completed"] as const).map((k) => {
        if (k === "completed" && !showCompleted) return null;
        if (groups[k].length === 0) return null;

        return (
          <div key={k} className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 capitalize">
              {t("signals." + k)}
            </div>

            <div className="space-y-2">
              {groups[k].map((p, idx) => (
                <div key={(p.id || p.key || "") + idx} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium">
                      {p.label || p.key || "\u041f\u0440\u043e\u0446\u0435\u0441\u0441"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.client_id ? t("signals.client", { id: p.client_id }) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pill(k)}
                    <a
                      href="/internal-processes"
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      {t("signals.open")}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}