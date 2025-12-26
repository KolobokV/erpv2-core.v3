import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiUrl } from "../lib/api";

type ClientProfile = {
  client_id?: string;
  id?: string;
  name?: string;
  title?: string;
  tax_mode?: string;
};

type ControlEvent = {
  id?: string;
  client_id?: string;
  title?: string;
  due_date?: string;
  status?: string;
};

type ProcessInstance = {
  id?: string;
  client_id?: string;
  title?: string;
  status?: string;
  started_at?: string;
};

type LoadResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function fetchJsonSafe<T>(url: string, fallback: T): Promise<LoadResult<T>> {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return { ok: false, error: `${res.status} ${res.statusText}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function ensureArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && typeof x === "object") {
    const anyObj = x as any;
    const v = anyObj.items ?? anyObj.data ?? anyObj.results ?? anyObj.value;
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

function pickClientId(p: ClientProfile): string {
  return (p.client_id || p.id || "").toString();
}

function pickClientName(p: ClientProfile): string {
  return (p.name || p.title || pickClientId(p) || "Unknown").toString();
}

export default function ClientProcessOverviewPage() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  const qClient = (sp.get("client") || "").trim();

  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [events, setEvents] = useState<ControlEvent[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [diag, setDiag] = useState<{ profiles?: string; events?: string; instances?: string }>({});

  const selectedClientId = useMemo(() => {
    if (qClient) return qClient;
    const first = profiles[0];
    return first ? pickClientId(first) : "";
  }, [qClient, profiles]);

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setLoading(true);
      setDiag({});

      const rProfiles = await fetchJsonSafe<ClientProfile[]>(apiUrl("/api/internal/client-profiles"), []);
      const rInstances = await fetchJsonSafe<ProcessInstance[]>(apiUrl("/api/internal/process-instances-v2/"), []);
      const rEvents = await fetchJsonSafe<ControlEvent[]>(apiUrl("/api/internal/control-events-store/"), []);

      if (!alive) return;

      if (rProfiles.ok) setProfiles(ensureArray<ClientProfile>(rProfiles.data as unknown));
      else setDiag((d) => ({ ...d, profiles: rProfiles.error }));

      if (rInstances.ok) setInstances(ensureArray<ProcessInstance>(rInstances.data as unknown));
      else setDiag((d) => ({ ...d, instances: rInstances.error }));

      if (rEvents.ok) setEvents(ensureArray<ControlEvent>(rEvents.data as unknown));
      else setDiag((d) => ({ ...d, events: rEvents.error }));

      setLoading(false);
    }

    void loadAll();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!qClient && selectedClientId) {
      const next = new URLSearchParams(sp);
      next.set("client", selectedClientId);
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const visibleProfiles = profiles.slice(0, 200);

  const clientInstances = useMemo(() => {
    if (!selectedClientId) return [];
    return instances.filter((x) => (x.client_id || "") === selectedClientId);
  }, [instances, selectedClientId]);

  const clientEvents = useMemo(() => {
    if (!selectedClientId) return [];
    return events.filter((x) => (x.client_id || "") === selectedClientId);
  }, [events, selectedClientId]);

  const anyErrors = Boolean(diag.profiles || diag.instances || diag.events);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Client process overview</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => nav("/onboarding")} style={{ padding: "8px 12px" }}>
            Onboarding hub
          </button>
          <button
            onClick={() => nav("/client-profile?client=" + encodeURIComponent(selectedClientId || ""))}
            style={{ padding: "8px 12px" }}
            disabled={!selectedClientId}
          >
            Client profile
          </button>
        </div>
      </div>

      {anyErrors ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #f59e0b", borderRadius: 8, background: "#fffbeb" }}>
          <div style={{ fontWeight: 600 }}>Backend internal endpoints are failing.</div>
          <div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, opacity: 0.9 }}>
            {diag.profiles ? <div>client-profiles: {diag.profiles}</div> : null}
            {diag.instances ? <div>process-instances-v2: {diag.instances}</div> : null}
            {diag.events ? <div>control-events-store: {diag.events}</div> : null}
          </div>
          <div style={{ marginTop: 8, opacity: 0.9 }}>
            UI stays usable: you can continue onboarding and open the client profile. Fixing backend errors is separate.
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12, marginTop: 16 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Clients</div>
          {loading && visibleProfiles.length === 0 ? <div style={{ opacity: 0.7 }}>Loading...</div> : null}
          {visibleProfiles.length === 0 && !loading ? (
            <div style={{ opacity: 0.7 }}>
              No clients loaded. Use onboarding to create a client, or fix backend internal endpoints.
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflow: "auto" }}>
            {visibleProfiles.map((p) => {
              const id = pickClientId(p);
              const name = pickClientName(p);
              const active = id && id === selectedClientId;
              return (
                <button
                  key={id || name}
                  onClick={() => {
                    const next = new URLSearchParams(sp);
                    next.set("client", id);
                    setSp(next, { replace: true });
                  }}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid " + (active ? "#93c5fd" : "#e5e7eb"),
                    background: active ? "#eff6ff" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{id}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>Selected client:</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
              {selectedClientId || "(none)"}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Process instances</div>
              {clientInstances.length === 0 ? <div style={{ opacity: 0.7 }}>Empty</div> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {clientInstances.slice(0, 50).map((x) => (
                  <div key={x.id || Math.random()} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{x.title || x.id || "Instance"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{x.status || ""}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Control events</div>
              {clientEvents.length === 0 ? <div style={{ opacity: 0.7 }}>Empty</div> : null}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {clientEvents.slice(0, 50).map((x) => (
                  <div key={x.id || Math.random()} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{x.title || x.id || "Event"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {(x.due_date ? "due " + x.due_date : "") + (x.status ? " | " + x.status : "")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
            Note: this page is resilient. It will not crash if backend returns 500. Errors are shown in the banner above.
          </div>
        </div>
      </div>
    </div>
  );
}
