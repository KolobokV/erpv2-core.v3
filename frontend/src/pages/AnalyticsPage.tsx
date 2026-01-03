import React from "react";
import RiskCoveragePanel from "../components/analytics/RiskCoveragePanel";

function getClientFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const c = params.get("client");
    return c && c.trim().length > 0 ? c.trim() : null;
  } catch {
    return null;
  }
}

export default function AnalyticsPage() {
  const clientId = getClientFromUrl();
  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Analytics</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Client param:{" "}
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
            {clientId ? clientId : "none"}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <RiskCoveragePanel period="30d" clientId={clientId} />
      </div>
    </div>
  );
}
