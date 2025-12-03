import React, { useEffect, useState } from "react";

interface ControlEvent {
  id: string;
  client_id: string;
  date: string;
  event_type: string;
  description: string;
  month: number;
  year: number;
}

interface ApiResponse {
  client_id: string;
  year: number;
  month: number;
  events: ControlEvent[];
}

const ControlEventsPage: React.FC = () => {
  const [clientId, setClientId] = useState<string>("1");
  const [year, setYear] = useState<number>(2025);
  const [month, setMonth] = useState<number>(1);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/control-events/${clientId}?year=${year}&month=${month}`
      );

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data: ApiResponse = await response.json();
      setEvents(data.events);
    } catch (err) {
      setError("Failed to load control events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 12,
          color: "#111827",
        }}
      >
        Control events
      </h2>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Client ID"
          style={{
            padding: "6px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            width: 100,
          }}
        />

        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{
            padding: "6px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            width: 90,
          }}
        />

        <input
          type="number"
          value={month}
          min={1}
          max={12}
          onChange={(e) => setMonth(Number(e.target.value))}
          style={{
            padding: "6px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            width: 70,
          }}
        />

        <button
          onClick={loadData}
          style={{
            padding: "6px 12px",
            backgroundColor: "#111827",
            color: "#ffffff",
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Load
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 14, color: "#6b7280" }}>Loading...</div>
      )}

      {error && (
        <div style={{ fontSize: 14, color: "#b91c1c" }}>{error}</div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 12,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              ID
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Date
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Type
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderBottom: "1px solid #e5e7eb",
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              Description
            </th>
          </tr>
        </thead>

        <tbody>
          {events.map((ev) => (
            <tr key={ev.id}>
              <td
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {ev.id}
              </td>
              <td
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {ev.date}
              </td>
              <td
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                  color: "#111827",
                }}
              >
                {ev.event_type}
              </td>
              <td
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                  color: "#374151",
                }}
              >
                {ev.description}
              </td>
            </tr>
          ))}

          {events.length === 0 && !loading && !error && (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "10px 8px",
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                No events found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ControlEventsPage;
