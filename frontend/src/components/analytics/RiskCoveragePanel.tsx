import React from "react";
import { fetchRiskSummary, RiskSummary } from "../../api/riskSafe";
import { fetchCoverageSummary, CoverageSummary } from "../../api/coverageSafe";

type Props = {
  period?: string;
  title?: string;
  clientId?: string | null;
};

function fmtPct(v: any): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "-";
  return `${Math.round(n * 100)}%`;
}

function fmtNum(v: any): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "-";
  return `${n}`;
}

export function RiskCoveragePanel({ period = "30d", title = "KPI / Risk / Coverage", clientId = null }: Props) {
  const [risk, setRisk] = React.useState<RiskSummary | null>(null);
  const [coverage, setCoverage] = React.useState<CoverageSummary | null>(null);
  const [err, setErr] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [r, c] = await Promise.all([fetchRiskSummary(clientId), fetchCoverageSummary(period, clientId)]);
      setRisk(r);
      setCoverage(c);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [period, clientId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const riskScore = risk?.score ?? risk?.riskScore ?? risk?.risk_score;
  const covVal = coverage?.coverage ?? coverage?.coverageRate ?? coverage?.coverage_rate;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            Scope: <b>{clientId ? "client" : "all"}</b>
            {clientId ? (
              <>
                {" "}
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{clientId}</span>
              </>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => void load()}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "6px 10px",
              background: "#fff",
              cursor: "pointer",
            }}
            title="Reload"
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Analytics fetch failed</div>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
            }}
          >
            {err}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Risk score</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmtNum(riskScore)}</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Overdue: <b>{fmtNum(risk?.overdueTasks ?? risk?.overdue)}</b>
            <br />
            Due soon: <b>{fmtNum(risk?.dueSoonTasks ?? risk?.dueSoon)}</b>
            <br />
            Total: <b>{fmtNum(risk?.totalTasks ?? risk?.total)}</b>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Coverage ({period})</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmtPct(covVal)}</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Covered: <b>{fmtNum(coverage?.coveredTasks ?? coverage?.covered)}</b>
            <br />
            Total: <b>{fmtNum(coverage?.totalTasks ?? coverage?.total)}</b>
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Top reasons</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(risk?.topReasons || risk?.reasons || []).slice(0, 6).map((x: any, i: number) => (
              <span
                key={`${i}-${String(x)}`}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  background: "#fff",
                }}
              >
                {String(x)}
              </span>
            ))}
            {(risk?.topReasons || risk?.reasons || []).length === 0 ? <span style={{ fontSize: 12, opacity: 0.7 }}>No data</span> : null}
          </div>
        </div>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>Raw payloads</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 10 }}>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 12,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(risk, null, 2)}
          </pre>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 12,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(coverage, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

export default RiskCoveragePanel;
