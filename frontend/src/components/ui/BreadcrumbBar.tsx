import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Crumb = {
  label: string;
  to?: string;
};

function routeLabel(pathname: string): string {
  const p = pathname.toLowerCase();

  if (p === "/") return "Reglement";
  if (p.startsWith("/day")) return "Day";
  if (p.startsWith("/tasks")) return "Tasks";
  if (p.startsWith("/task-detail")) return "Task";
  if (p.startsWith("/internal-processes")) return "Processes";
  if (p.startsWith("/process-coverage")) return "Coverage";
  if (p.startsWith("/client-profile")) return "Client profile";
  if (p.startsWith("/control-events")) return "Control events";
  if (p.startsWith("/internal-control-events-store")) return "Events store";
  if (p.startsWith("/client-process-overview")) return "Client overview";
  if (p.startsWith("/process-chains-dev")) return "Chains dev";

  return "Page";
}

function buildCrumbs(pathname: string): Crumb[] {
  const label = routeLabel(pathname);

  if (pathname === "/") {
    return [{ label: "Reglement" }];
  }

  return [{ label: "Reglement", to: "/" }, { label }];
}

function getClientFromSearch(search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    return (sp.get("client") || "").trim();
  } catch {
    return "";
  }
}

function clearClientFromUrl(pathname: string, search: string): string {
  try {
    const sp = new URLSearchParams(search || "");
    if (!sp.has("client")) return pathname + (search || "");
    sp.delete("client");
    const next = sp.toString();
    return pathname + (next ? "?" + next : "");
  } catch {
    return pathname;
  }
}

const BreadcrumbBar: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();

  const crumbs = useMemo(() => buildCrumbs(loc.pathname), [loc.pathname]);
  const client = useMemo(() => getClientFromSearch(loc.search), [loc.search]);

  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <div className="mb-4">
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {crumbs.map((c, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-300">/</span>}
                {c.to ? (
                  <button
                    type="button"
                    onClick={() => nav(c.to!)}
                    className="text-slate-700 hover:underline"
                  >
                    {c.label}
                  </button>
                ) : (
                  <span className="text-slate-500">{c.label}</span>
                )}
              </React.Fragment>
            ))}

            {client && (
              <>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                  <span className="text-slate-500">client</span>
                  <span className="font-medium">{client}</span>
                  <button
                    type="button"
                    className="ml-1 rounded-full px-1 text-[11px] text-slate-500 hover:bg-slate-100"
                    title="Clear client context"
                    onClick={() => nav(clearClientFromUrl(loc.pathname, loc.search))}
                  >
                    x
                  </button>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => nav("/")}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              title="Up to Reglement"
            >
              Up
            </button>

            <button
              type="button"
              onClick={() => (canGoBack ? nav(-1) : nav("/"))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              title="Back"
            >
              Back
            </button>
          </div>
        </div>

        {client && (
          <div className="mt-2 text-[11px] text-slate-500">
            Context is read from URL (?client=). Next step: pages will auto-filter by this context.
          </div>
        )}
      </div>
    </div>
  );
};

export default BreadcrumbBar;