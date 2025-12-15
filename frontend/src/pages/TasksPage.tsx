import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { UpBackBar } from "../components/UpBackBar";
import { getClientFromLocation } from "../v27/clientContext";
import { buildV27Bundle } from "../v27/bridge";
import { loadMaterializedTasksV27 } from "../v27/profileStore";

export default function TasksPage() {
  const location = useLocation();
  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const [bundleJson, setBundleJson] = useState<string>("");

  useEffect(() => {
    const materialized = loadMaterializedTasksV27(clientId);
    const bundle = buildV27Bundle(clientId, materialized);
    setBundleJson(JSON.stringify(bundle, null, 2));
  }, [clientId]);

  return (
    <PageShell>
      <UpBackBar title={`Tasks: ${clientId || "-"}`} />
      <div style={{ padding: 12 }}>
        <pre style={{ whiteSpace: "pre-wrap" }}>{bundleJson}</pre>
      </div>
    </PageShell>
  );
}