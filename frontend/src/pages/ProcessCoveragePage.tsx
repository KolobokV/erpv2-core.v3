import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface ClientProfile {
  id: string;
  name: string;
  tax_regime: string;
  employees_count: number;
  salary_dates: number[];
  has_vat: boolean;
  has_tourist_fee: boolean;
  auto_generate_bank_tasks: boolean;
}

interface ProcessDefinition {
  id: string;
  name: string;
  scope: string | null;
}

interface ProcessInstance {
  id: string;
  definition_id: string;
  client_id: string;
  month: string;
}

export default function ProcessCoveragePage() {
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [definitions, setDefinitions] = useState<ProcessDefinition[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);

  const [currentMonth, setCurrentMonth] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrentMonth(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );

    const loadAll = async () => {
      setLoading(true);
      setError(null);

      try {
        const [profilesRes, defsRes, instRes] = await Promise.all([
          fetch("/api/internal/client-profiles"),
          fetch("/api/internal/process-definitions"),
          fetch("/api/internal/process-instances"),
        ]);

        if (!profilesRes.ok || !defsRes.ok || !instRes.ok) {
          const statuses = [
            profilesRes.status,
            defsRes.status,
            instRes.status,
          ].join(", ");
          throw new Error(
            `Failed to load process coverage data (statuses: ${statuses})`
          );
        }

        let profilesJson: any = null;
        let defsJson: any = null;
        let instJson: any = null;

        try {
          profilesJson = await profilesRes.json();
        } catch (err) {
          console.error("Failed to parse client profiles JSON", err);
          profilesJson = { items: [] };
        }

        try {
          defsJson = await defsRes.json();
        } catch (err) {
          console.error("Failed to parse process definitions JSON", err);
          defsJson = { items: [] };
        }

        try {
          instJson = await instRes.json();
        } catch (err) {
          console.error("Failed to parse process instances JSON", err);
          instJson = { items: [] };
        }

        setProfiles(
          Array.isArray(profilesJson) ? profilesJson : profilesJson.items ?? []
        );
        setDefinitions(
          Array.isArray(defsJson) ? defsJson : defsJson.items ?? []
        );
        setInstances(
          Array.isArray(instJson) ? instJson : instJson.items ?? []
        );
      } catch (e: any) {
        console.error("ProcessCoveragePage load error:", e);
        setError(e?.message ?? "Failed to load process coverage data");
        setProfiles([]);
        setDefinitions([]);
        setInstances([]);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const getDefinitionsForProfile = (profile: ClientProfile) => {
    return definitions.filter(
      (d) => !d.scope || d.scope === profile.tax_regime
    );
  };

  const getInstancesForProfile = (profile: ClientProfile) => {
    return instances.filter(
      (i) => i.client_id === profile.id && i.month === currentMonth
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Process Coverage Matrix</h2>
      <p style={{ opacity: 0.7 }}>Current month: {currentMonth}</p>

      {loading && (
        <div
          style={{
            marginTop: 8,
            marginBottom: 8,
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          Loading process coverage data...
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 8,
            marginBottom: 8,
            padding: "8px 10px",
            borderRadius: 8,
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Client</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Regime</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>
              Processes (available)
            </th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>
              Instances (current month)
            </th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Missing</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => {
            const defs = getDefinitionsForProfile(p);
            const inst = getInstancesForProfile(p);

            const missing = defs.length - inst.length;

            return (
              <tr key={p.id}>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  <Link to={`/client/${p.id}`}>{p.name}</Link>
                </td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  {p.tax_regime}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  {defs.length}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  {inst.length > 0 ? (
                    <Link to="/internal">{inst.length}</Link>
                  ) : (
                    "0"
                  )}
                </td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  {missing > 0 ? (
                    <span style={{ color: "red" }}>{missing}</span>
                  ) : (
                    <span style={{ color: "green" }}>OK</span>
                  )}
                </td>
              </tr>
            );
          })}

          {profiles.length === 0 && !loading && !error && (
            <tr>
              <td
                colSpan={5}
                style={{
                  border: "1px solid #ddd",
                  padding: 8,
                  fontSize: 13,
                  color: "#6b7280",
                  textAlign: "center",
                }}
              >
                No client profiles found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 20 }}>
        <Link to="/internal" style={{ color: "#0066ff" }}>
          Go to Internal Processes
        </Link>
      </div>
    </div>
  );
}
