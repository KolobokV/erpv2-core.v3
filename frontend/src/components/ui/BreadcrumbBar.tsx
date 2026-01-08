import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Crumb = {
  label: string;
  to?: string;
};

const S_HOME = "\u0420\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442";
const S_DAY = "\u0414\u0435\u043d\u044c";
const S_TASKS = "\u0417\u0430\u0434\u0430\u0447\u0438";
const S_TASK = "\u0417\u0430\u0434\u0430\u0447\u0430";
const S_PROCESSES = "\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b";
const S_COVERAGE = "\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435";
const S_CLIENT = "\u041a\u043b\u0438\u0435\u043d\u0442";
const S_EVENTS = "\u0421\u043e\u0431\u044b\u0442\u0438\u044f";
const S_STORE = "\u0425\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435";
const S_OVERVIEW = "\u041e\u0431\u0437\u043e\u0440";
const S_ANALYTICS = "\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430";
const S_BACK = "\u041d\u0430\u0437\u0430\u0434";
const S_UP = "\u0414\u043e\u043c\u043e\u0439";
const S_CLIENT_PREFIX = "\u041a\u043b\u0438\u0435\u043d\u0442:";

function routeLabel(pathname: string): string {
  const p = (pathname || "").toLowerCase();

  if (p === "/") return S_HOME;
  if (p.startsWith("/day")) return S_DAY;
  if (p.startsWith("/tasks")) return S_TASKS;
  if (p.startsWith("/task-detail")) return S_TASK;
  if (p.startsWith("/internal-processes")) return S_PROCESSES;
  if (p.startsWith("/process-coverage")) return S_COVERAGE;
  if (p.startsWith("/client-profile")) return S_CLIENT;
  if (p.startsWith("/control-events")) return S_EVENTS;
  if (p.startsWith("/internal-control-events-store")) return S_STORE;
  if (p.startsWith("/client-process-overview")) return S_OVERVIEW;
  if (p.startsWith("/events")) return S_EVENTS;
  if (p.startsWith("/coverage")) return S_COVERAGE;
  if (p.startsWith("/analytics")) return S_ANALYTICS;

  return S_HOME;
}

function buildCrumbs(pathname: string): Crumb[] {
  const label = routeLabel(pathname);

  if (pathname === "/" || pathname === "") {
    return [{ label: S_HOME }];
  }

  return [{ label: S_HOME, to: "/" }, { label }];
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
    const s = sp.toString();
    return pathname + (s ? "?" + s : "");
  } catch {
    return pathname;
  }
}

export function BreadcrumbBar() {
  const loc = useLocation();
  const nav = useNavigate();

  const crumbs = useMemo(() => buildCrumbs(loc.pathname), [loc.pathname]);
  const client = useMemo(() => getClientFromSearch(loc.search), [loc.search]);
  const clearClientTo = useMemo(() => clearClientFromUrl(loc.pathname, loc.search), [loc.pathname, loc.search]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => nav(-1)}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.6)" }}
        >
          {S_BACK}
        </button>

        <button
          onClick={() => nav("/")}
          style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.6)" }}
        >
          {S_UP}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13 }}>
          {crumbs.map((c, idx) => (
            <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {c.to ? (
                <a
                  href={c.to}
                  style={{ textDecoration: "none", color: "rgba(0,0,0,0.85)", fontWeight: 700 }}
                >
                  {c.label}
                </a>
              ) : (
                <span style={{ fontWeight: 700 }}>{c.label}</span>
              )}
              {idx < crumbs.length - 1 && <span style={{ opacity: 0.4 }}>/</span>}
            </span>
          ))}
        </div>
      </div>

      {client ? (
        <a
          href={clearClientTo}
          style={{
            textDecoration: "none",
            fontSize: 13,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.6)",
            color: "rgba(0,0,0,0.85)",
          }}
          title={S_CLIENT_PREFIX + " " + client}
        >
          {S_CLIENT_PREFIX} <b>{client}</b>
        </a>
      ) : null}
    </div>
  );
}

export default BreadcrumbBar;
