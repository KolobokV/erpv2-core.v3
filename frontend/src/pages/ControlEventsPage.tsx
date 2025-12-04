import React, { useEffect, useState } from "react";

interface ControlEvent {
  id: string;
  client_id: string;
  date: string;
  title: string;
  category: string;
  status: "planned" | "overdue" | "completed";
  depends_on: string[];
  description?: string;
  tags: string[];
  source?: string;
}

interface ApiResponse {
  client_id: string;
  events: ControlEvent[];
}

interface TaskPayload {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignee: string | null;
  created_at: string;
  updated_at: string | null;
  due_date: string | null;
}

interface GenerateTasksResponse {
  client_id: string;
  tasks_suggested: number;
  tasks: TaskPayload[];
}

const ControlEventsPage: React.FC = () => {
  const now = new Date();

  const [clientId, setClientId] = useState<string>("demo-client-1");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [generating, setGenerating] = useState<boolean>(false);
  const [generateMessage, setGenerateMessage] = useState<string>("");

  const buildQueryUrl = (base: string) => {
    const params = new URLSearchParams();
    if (year) {
      params.append("year", year.toString());
    }
    if (month) {
      params.append("month", month.toString());
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      setGenerateMessage("");

      const url = buildQueryUrl(`/api/control-events/${clientId}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data: ApiResponse = await response.json();
      setEvents(data.events);
    } catch (err) {
      console.error(err);
      setError("Failed to load control events");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "overdue":
        return "#dc2626";
      case "completed":
        return "#16a34a";
      default:
        return "#2563eb";
    }
  };

  const generateTasks = async () => {
    if (events.length === 0) {
      setError("No events to generate tasks from");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setGenerateMessage("");

      const genUrl = buildQueryUrl(
        `/api/control-events/${clientId}/generate-tasks`
      );

      const genResponse = await fetch(genUrl, {
        method: "POST",
      });

      if (!genResponse.ok) {
        throw new Error("Failed to build task payloads");
      }

      const genData: GenerateTasksResponse = await genResponse.json();

      if (!genData.tasks || genData.tasks.length === 0) {
        setError("No tasks were suggested by backend");
        return;
      }

      for (const task of genData.tasks) {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(task),
        });

        if (!response.ok) {
          throw new Error("Failed to create task");
        }
      }

      setGenerateMessage(
        `Tasks generated from control events: ${genData.tasks.length}`
      );
    } catch (err) {
      console.error(err);
      setError("Failed to generate tasks");
    } finally {
      setGenerating(false);
    }
  };

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

  const currentMonthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? month.toString();

  const statusDot = (color: string) => (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 9999,
        backgroundColor: color,
      }}
    />
  );

  return (
    <div
      style={{
        backgroundColor: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 4,
              color: "#111827",
            }}
          >
            Control events
          </h2>
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            Period view for regulatory events and deadlines.
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            minWidth: 200,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.04,
              color: "#9ca3af",
              marginBottom: 2,
            }}
          >
            Context
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#111827",
            }}
          >
            Client: <span style={{ fontWeight: 600 }}>{clientId}</span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#4b5563",
              marginTop: 2,
            }}
          >
            Period: {currentMonthLabel} {year}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#9ca3af",
            }}
          >
            Events:{" "}
            <span style={{ fontWeight: 600, color: "#4b5563" }}>
              {events.length}
            </span>
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.04,
              color: "#9ca3af",
            }}
          >
            Status legend
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#4b5563",
              }}
            >
              {statusDot("#dc2626")} Overdue
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#4b5563",
              }}
            >
              {statusDot("#2563eb")} Planned
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#4b5563",
              }}
            >
              {statusDot("#16a34a")} Completed
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
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
            width: 160,
            backgroundColor: "#ffffff",
          }}
        />

        <input
          type="number"
          value={year}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!Number.isNaN(value)) {
              setYear(value);
            }
          }}
          placeholder="Year"
          style={{
            padding: "6px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            width: 90,
            backgroundColor: "#ffffff",
          }}
        />

        <select
          value={month}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (!Number.isNaN(value)) {
              setMonth(value);
            }
          }}
          style={{
            padding: "6px 8px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 14,
            backgroundColor: "#ffffff",
          }}
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

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
          disabled={loading}
        >
          {loading ? "Loading..." : "Load"}
        </button>

        <button
          onClick={generateTasks}
          style={{
            padding: "6px 12px",
            backgroundColor: "#2563eb",
            color: "#ffffff",
            borderRadius: 6,
            border: "none",
            cursor: events.length === 0 ? "not-allowed" : "pointer",
            fontSize: 14,
            opacity: events.length === 0 || generating ? 0.7 : 1,
          }}
          disabled={events.length === 0 || loading || generating}
        >
          {generating ? "Generating..." : "Generate tasks"}
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 14, color: "#6b7280" }}>Loading events...</div>
      )}

      {generating && !loading && (
        <div style={{ fontSize: 14, color: "#6b7280" }}>
          Generating tasks from events...
        </div>
      )}

      {error && (
        <div style={{ fontSize: 14, color: "#b91c1c", marginTop: 4 }}>
          {error}
        </div>
      )}

      {generateMessage && !error && (
        <div style={{ fontSize: 14, color: "#16a34a", marginTop: 4 }}>
          {generateMessage}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          border: "1px solid #e5e7eb",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead
            style={{
              backgroundColor: "#f3f4f6",
            }}
          >
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
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                Status
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
                Depends on
              </th>
            </tr>
          </thead>

          <tbody>
            {events.map((ev) => (
              <tr
                key={ev.id}
                style={{
                  backgroundColor: "#ffffff",
                }}
              >
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                    color: "#111827",
                    whiteSpace: "nowrap",
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
                  {ev.title}
                </td>

                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 6px",
                      borderRadius: 9999,
                      backgroundColor: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 11,
                    }}
                  >
                    {ev.category}
                  </span>
                </td>

                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                    color: statusColor(ev.status),
                    fontWeight: 600,
                  }}
                >
                  {ev.status}
                </td>

                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  {ev.depends_on.length === 0
                    ? "-"
                    : ev.depends_on.join(", ")}
                </td>
              </tr>
            ))}

            {events.length === 0 && !loading && !error && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "10px 8px",
                    fontSize: 13,
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  No events found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ControlEventsPage;
