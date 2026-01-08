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

const S_CLIENT = "\u041a\u043b\u0438\u0435\u043d\u0442";
const S_DAY = "\u0414\u0435\u043d\u044c";
const S_TASKS = "\u0417\u0430\u0434\u0430\u0447\u0438";
const S_PROCESSES = "\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b";
const S_COVERAGE = "\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435";

export function ClientCockpitHeader() {
  const loc = useLocation();
  const uuid = useMemo(() => extractUuid(loc.pathname), [loc.pathname]);

  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<ClientProfile | null>(null);

  useEffect(() => {
    let alive = true;
    fetchClientProfilesSafe()
      .then((list) => {
        if (!alive) return;
        setProfiles(list || []);
      })
      .catch(() => {
        if (!alive) return;
        setProfiles([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!uuid) {
      setActiveProfile(null);
      return;
    }
    const found = (profiles || []).find((p) => p.id === uuid) || null;
    setActiveProfile(found);
  }, [uuid, profiles]);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 260, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>{S_CLIENT}</div>
        <div
          style={{
            fontSize: 13,
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.5)",
            maxWidth: 520,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={activeProfile?.name || ""}
        >
          {activeProfile?.name || "\u2014"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <NavBtn to="/day" label={S_DAY} />
        <NavBtn to="/tasks" label={S_TASKS} />
        <NavBtn to="/internal-processes" label={S_PROCESSES} />
        <NavBtn to="/process-coverage" label={S_COVERAGE} />
      </div>
    </div>
  );
}

export default ClientCockpitHeader;
