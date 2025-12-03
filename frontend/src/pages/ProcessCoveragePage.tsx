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

  useEffect(() => {
    const now = new Date();
    setCurrentMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    fetch("/api/internal/client-profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.items || []));

    fetch("/api/internal/process-definitions")
      .then((r) => r.json())
      .then((d) => setDefinitions(d.items || []));

    fetch("/api/internal/process-instances")
      .then((r) => r.json())
      .then((d) => setInstances(d.items || []));
  }, []);

  const getDefinitionsForProfile = (profile: ClientProfile) => {
    return definitions.filter((d) => !d.scope || d.scope === profile.tax_regime);
  };

  const getInstancesForProfile = (profile: ClientProfile) => {
    return instances.filter((i) => i.client_id === profile.id && i.month === currentMonth);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Process Coverage Matrix</h2>
      <p style={{ opacity: 0.7 }}>Current month: {currentMonth}</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Client</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Regime</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Processes (available)</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Instances (current month)</th>
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
                <td style={{ border: "1px solid #ddd", padding: 8 }}>{p.tax_regime}</td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>{defs.length}</td>
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
