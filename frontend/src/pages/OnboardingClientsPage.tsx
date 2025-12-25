import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getOnboardingClients, setLastActiveClient } from "../lib/onboardingLocal";

export default function OnboardingClientsPage() {
  const nav = useNavigate();
  const clients = useMemo(() => getOnboardingClients(), []);

  const open = (path: string, clientId: string) => {
    setLastActiveClient(clientId);
    nav(path + "?client=" + encodeURIComponent(clientId));
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Onboarding clients</h2>
      <div style={{ marginTop: 8, opacity: 0.75 }}>
        This is a local list (browser storage). Next: wire to backend.
      </div>

      <div style={{ marginTop: 12 }}>
        {clients.length === 0 ? (
          <div style={{ opacity: 0.7 }}>
            Empty. Go to <a href="/client-create">/client-create</a>, create and confirm a client.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {clients.map((c) => (
              <div
                key={c.clientId}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{c.clientId}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{c.createdAtIso}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => open("/day", c.clientId)} style={{ padding: "8px 12px" }}>
                    Day
                  </button>
                  <button onClick={() => open("/tasks", c.clientId)} style={{ padding: "8px 12px" }}>
                    Tasks
                  </button>
                  <button onClick={() => open("/client-profile", c.clientId)} style={{ padding: "8px 12px" }}>
                    Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}