import React from "react";
import { NavLink } from "react-router-dom";

export type ErpNavItem = {
  to: string;
  label: string;
};

export function ErpShell(props: {
  title?: string;
  subtitle?: string;
  clientId?: string | null;
  nav: ErpNavItem[];
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { title, subtitle, clientId, nav, right, children } = props;

  return (
    <div className="erp-app">
      <div className="erp-shell">
        <aside className="erp-sidebar">
          <div className="erp-brand">
            <div className="erp-brand-title">{title || "ERPv2"}</div>
            <div className="erp-brand-sub">{subtitle || "Workday"}</div>
          </div>

          <nav className="erp-nav">
            {nav.map((x) => (
              <NavLink
                key={x.to}
                to={x.to}
                className={({ isActive }) => (isActive ? "erp-active" : "")}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    background: "rgba(15,23,42,0.08)",
                    flex: "0 0 auto",
                  }}
                />
                <span>{x.label}</span>
              </NavLink>
            ))}
</nav>
        </aside>

        <main className="erp-main">
          <div className="erp-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {clientId ? (
                <div className="erp-chip">
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "#10b981" }} />
                  <span>{"client=" + clientId}</span>
                </div>
              ) : (
                <div className="erp-chip">
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(15,23,42,0.35)" }} />
                  <span>{"no client"}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {right || null}
            </div>
          </div>

          <div className="erp-content"><div className="dash-page">{children}</div></div>
        </main>
      </div>
    </div>
  );
}