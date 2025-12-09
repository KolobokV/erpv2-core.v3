import React, { useEffect, useState } from "react";

type ProcessInstance = {
  id?: string | null;
  client_id?: string;
  period?: string;
  status?: string;
  computed_status?: string;
};

type InstancesResponse = {
  clients?: { client_id: string }[];
  instances?: ProcessInstance[];
};

function normalizeStatus(raw?: string | null): string {
  const s = (raw || "").toLowerCase();
  if (s === "completed" || s === "closed") return "closed";
  if (s === "waiting" || s === "open") return "open";
  if (s === "error" || s === "stuck") return "stuck";
  if (!s) return "unknown";
  return s;
}

export default function InternalProcessesPage() {
  const [items, setItems] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const r = await fetch("/api/internal/process-instances-v2/");
      if (!r.ok) {
        throw new Error("HTTP " + r.status);
      }
      const data: InstancesResponse = await r.json();
      const list = Array.isArray(data.instances) ? data.instances : [];
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load instances");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const total = items.length;
  const byStatus: Record<string, number> = {};
  for (const inst of items) {
    const s = normalizeStatus(inst.computed_status || inst.status);
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
        Internal processes
      </h2>
      <p style={{ fontSize: 12, color: "#4b5563", marginBottom: 12 }}>
        Simple debug view over process instances store.
      </p>

      <div style={{ fontSize: 12, marginBottom: 12 }}>
        <span style={{ marginRight: 16 }}>Total: {total}</span>
        <span style={{ marginRight: 8 }}>closed: {byStatus["closed"] || 0}</span>
        <span style={{ marginRight: 8 }}>open: {byStatus["open"] || 0}</span>
        <span style={{ marginRight: 8 }}>stuck: {byStatus["stuck"] || 0}</span>
        <span style={{ marginRight: 8 }}>other: {byStatus["other"] || 0}</span>
      </div>

      {loading && <div>Loading instances...</div>}
      {error && (
        <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ fontSize: 12, color: "#6b7280" }}>No instances found.</div>
      )}

      {items.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: 520,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                  Client
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                  Period
                </th>
                <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((inst) => {
                const s = normalizeStatus(inst.computed_status || inst.status);
                let color = "#111827";
                if (s === "closed") color = "#047857";
                else if (s === "open") color = "#1d4ed8";
                else if (s === "stuck") color = "#b91c1c";

                const key =
                  inst.id ||
                  `${inst.client_id || "unknown"}::${inst.period || "unknown"}`;

                return (
                  <tr key={key}>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                      {inst.client_id}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                      {inst.period}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        borderBottom: "1px solid #f3f4f6",
                        color,
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
