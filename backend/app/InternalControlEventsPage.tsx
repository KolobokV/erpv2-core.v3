import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UpBackBar } from "../components/UpBackBar";

type AnyStore = any;

type FlatEvent = {
  id?: string;
  client_id?: string;
  year?: number | string;
  month?: number | string;
  code?: string;
  status?: string;
  [key: string]: any;
};

function extractEvents(store: AnyStore): FlatEvent[] {
  if (!store) {
    return [];
  }
  if (Array.isArray(store)) {
    return store as FlatEvent[];
  }
  if (Array.isArray(store.events)) {
    return store.events as FlatEvent[];
  }
  if (Array.isArray(store.items)) {
    return store.items as FlatEvent[];
  }
  return [];
}

export default function InternalControlEventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const sp = new URLSearchParams(location.search || "");
  const client = sp.get("client") || sp.get("client_id") || sp.get("client_code") || "";
  const [store, setStore] = useState<AnyStore | null>(null);
  const [events, setEvents] = useState<FlatEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllEvents();
  }, []);

  async function loadAllEvents() {
    try {
      setLoading(true);
      setError(null);

      const r = await fetch("/api/internal/control-events-store/");
      if (!r.ok) {
        throw new Error("HTTP " + r.status);
      }
      const json = await r.json();
      setStore(json);
      setEvents(extractEvents(json));
    } catch (e: any) {
      setError(e?.message || "Failed to load control events store");
      setStore(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  const byClient: Record<string, number> = {};
  for (const ev of events) {
    const cid = String(ev.client_id || "unknown");
    byClient[cid] = (byClient[cid] || 0) + 1;
  }

  return (
    <div style={{ padding: 4 }}>
      <UpBackBar
        title="Internal control events"
        onUp={() => navigate("/")}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a className="erp-btn erp-btn-ghost" href={client ? ("/day?client=" + encodeURIComponent(client)) : "/day"}>Day</a>
            <a className="erp-btn erp-btn-ghost" href={client ? ("/tasks?client=" + encodeURIComponent(client)) : "/tasks"}>Tasks</a>
            <a className="erp-btn erp-btn-ghost" href={client ? ("/client-profile?client=" + encodeURIComponent(client)) : "/client-profile"}>Client</a>
          </div>
        }
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>
          Control events store
        </h2>
        <button
          type="button"
          onClick={loadAllEvents}
          style={{ padding: "4px 10px" }}
        >
          Reload
        </button>
      </div>

      {loading && <div style={{ fontSize: 12 }}>Loading...</div>}

      {error && (
        <div
          style={{
            fontSize: 12,
            color: "#b91c1c",
            marginBottom: 8,
          }}
        >
          Error: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <p
            style={{
              fontSize: 11,
              color: "#6b7280",
              marginBottom: 8,
            }}
          >
            Total events: {events.length}. Clients in store:{" "}
            {Object.keys(byClient).length}.
          </p>

          {events.length > 0 && (
            <>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Per client summary
              </h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  marginBottom: 12,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 4,
                      }}
                    >
                      Client id
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 4,
                      }}
                    >
                      Events count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(byClient).map((cid) => (
                    <tr key={cid}>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 4,
                        }}
                      >
                        {cid}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #f3f4f6",
                          padding: 4,
                        }}
                      >
                        {byClient[cid]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                Flat events (first 200)
              </h3>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  marginBottom: 12,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 4,
                      }}
                    >
                      Client
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 4,
                      }}
                    >
                      Period
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 4,
                      }}
                    >
                      Code
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #e5e7eb",
                        padding: 4,
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 200).map((ev, idx) => {
                    const period =
                      (ev.year ?? "") +
                      (ev.month
                        ? "-" +
                          String(ev.month)
                            .toString()
                            .padStart(2, "0")
                        : "");
                    return (
                      <tr key={ev.id || idx}>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 4,
                          }}
                        >
                          {ev.client_id || "-"}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 4,
                          }}
                        >
                          {period || "-"}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 4,
                          }}
                        >
                          {ev.code || ev.event_code || "-"}
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            padding: 4,
                          }}
                        >
                          {ev.status || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          <details>
            <summary
              style={{
                fontSize: 11,
                cursor: "pointer",
                marginBottom: 4,
              }}
            >
              Raw store payload
            </summary>
            <pre
              style={{
                fontSize: 11,
                backgroundColor: "#f9fafb",
                border: "1px solid #e5e7eb",
                padding: 8,
                borderRadius: 4,
                maxHeight: 260,
                overflow: "auto",
              }}
            >
              {JSON.stringify(store, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
