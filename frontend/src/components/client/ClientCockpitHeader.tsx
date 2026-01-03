import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { fetchClientProfilesSafe, type ClientProfile } from "../../api/clientProfilesSafe";

function NavBtn({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(255,255,255,0.6)",
        fontSize: 13,
        color: "rgba(0,0,0,0.85)",
      }}
    >
      {label}
    </Link>
  );
}

function extractUuid(pathname: string): string | null {
  const m = pathname.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return m ? m[0] : null;
}

function shortId(id: string): string {
  if (!id) return "";
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export default function ClientCockpitHeader() {
  const loc = useLocation();

  const clientId = useMemo(() => extractUuid(loc.pathname), [loc.pathname]);
  const [clientName, setClientName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!clientId) {
        setClientName(null);
        return;
      }

      try {
        const items = await fetchClientProfilesSafe();
        const hit = (items || []).find((x: ClientProfile) => String(x.id) === String(clientId));
        if (alive) setClientName(hit?.name ? String(hit.name) : null);
      } catch {
        if (alive) setClientName(null);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [clientId]);

  const title = clientName || (clientId ? `Client ${shortId(clientId)}` : "Client");
  const subtitle = clientId ? `ID: ${shortId(clientId)}` : loc.pathname;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.5)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </div>
          <span style={{ fontSize: 12, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <NavBtn to="/tasks" label="Tasks" />
        <NavBtn to="/internal-processes" label="Processes" />
        <NavBtn to="/day" label="Day" />
      </div>
    </div>
  );
}
