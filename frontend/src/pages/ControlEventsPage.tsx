import React, { useEffect, useMemo, useState } from "react";

type ControlEvent = {
  id: string;
  client_id: string;
  title: string;
  date: string;
  category: string;
  depends_on?: string;
};

type ControlEventsResponse = {
  client_id: string;
  year: number;
  month: number;
  events: ControlEvent[];
};

type ClientPreset = {
  id: string;
  label: string;
  description: string;
};

const clientPresets: ClientPreset[] = [
  {
    id: "ip_usn_demo",
    label: "IP USN (demo)",
    description: "IP on simplified tax system",
  },
  {
    id: "ooo_vat_demo",
    label: "LLC with VAT (demo)",
    description: "LLC with VAT, salary 10 and 25",
  },
  {
    id: "ooo_usn_tour_demo",
    label: "LLC USN + tourist fee (demo)",
    description: "LLC on USN + tourist fee, salary 5 and 20",
  },
];

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const getTodayYearMonth = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

const ControlEventsPage: React.FC = () => {
  const { year: initialYear, month: initialMonth } = useMemo(
    () => getTodayYearMonth(),
    []
  );

  const [clientId, setClientId] = useState<string>("ip_usn_demo");
  const [year, setYear] = useState<number>(initialYear);
  const [month, setMonth] = useState<number>(initialMonth);
  const [data, setData] = useState<ControlEventsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clientPresets.find((c) => c.id === clientId);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });

      const res = await fetch(
        `/api/control-events/${clientId}?` + params.toString()
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json: ControlEventsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Failed to load control events", err);
      setError(err.message || "Failed to load control events");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, year, month]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Control events calendar
      </h1>

      <div
        style={{
          fontSize: 13,
          color: "#4b5563",
          marginBottom: 4,
        }}
      >
        This view uses demo clients and a simple monthly schedule.
        Later it can be connected to real client profiles and internal scheduler.
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          padding: 10,
          borderRadius: 8,
          backgroundColor: "#f3f4f6",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", minWidth: 220 }}
        >
          <label
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 2,
            }}
          >
            Client preset
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={{
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
            }}
          >
            {clientPresets.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </select>
          {selectedClient && (
            <div
              style={{
                marginTop: 2,
                fontSize: 11,
                color: "#9ca3af",
              }}
            >
              {selectedClient.description}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: 90 }}>
          <label
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 2,
            }}
          >
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
            }}
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", width: 90 }}>
          <label
            style={{
              fontSize: 12,
              color: "#6b7280",
              marginBottom: 2,
            }}
          >
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
            }}
          />
        </div>

        <button
          type="button"
          onClick={fetchEvents}
          style={{
            marginTop: 18,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #4b5563",
            backgroundColor: "#111827",
            color: "#ffffff",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          backgroundColor: "#ffffff",
          padding: 12,
        }}
      >
        {loading && (
          <div
            style={{
              fontSize: 13,
              color: "#4b5563",
            }}
          >
            Loading control events...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              fontSize: 13,
              color: "#b91c1c",
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && data && data.events.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            No events for this period.
          </div>
        )}

        {!loading && !error && data && data.events.length > 0 && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
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
                  Title
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
                  Category
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    borderBottom: "1px solid "#e5e7eb",
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  Depends on
                </th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id}>
                  <td
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #f3f4f6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {event.date}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    {event.title}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #f3f4f6",
                      textTransform: "capitalize",
                    }}
                  >
                    {event.category}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #f3f4f6",
                      color: "#9ca3af",
                      fontSize: 12,
                    }}
                  >
                    {event.depends_on || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ControlEventsPage;
