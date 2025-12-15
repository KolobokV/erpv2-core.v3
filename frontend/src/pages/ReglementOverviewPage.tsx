import React, { useEffect, useMemo, useState } from "react";

import {
  fetchClientProfilesSafe,
  fetchTasksSafe,
  fetchProcessInstancesV2Safe,
} from "../api";

type UiState = "idle" | "loading" | "ready";

export default function ReglementOverviewPage() {
  const [uiState, setUiState] = useState<UiState>("idle");

  const [profilesMeta, setProfilesMeta] = useState<{ state: string; status: number }>({
    state: "idle",
    status: 0,
  });
  const [tasksMeta, setTasksMeta] = useState<{ state: string; status: number }>({
    state: "idle",
    status: 0,
  });
  const [instancesMeta, setInstancesMeta] = useState<{ state: string; status: number }>({
    state: "idle",
    status: 0,
  });

  const [profilesCount, setProfilesCount] = useState<number>(0);
  const [tasksCount, setTasksCount] = useState<number>(0);
  const [instancesCount, setInstancesCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setUiState("loading");

      const [p, t, i] = await Promise.all([
        fetchClientProfilesSafe(),
        fetchTasksSafe(),
        fetchProcessInstancesV2Safe(),
      ]);

      if (cancelled) return;

      setProfilesMeta({ state: p.meta.state, status: p.status });
      setTasksMeta({ state: t.meta.state, status: t.status });
      setInstancesMeta({ state: i.meta.state, status: i.status });

      setProfilesCount(Array.isArray(p.data.items) ? p.data.items.length : 0);
      setTasksCount(Array.isArray(t.data.tasks) ? t.data.tasks.length : 0);
      setInstancesCount(Array.isArray(i.data.items) ? i.data.items.length : 0);

      setUiState("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const healthText = useMemo(() => {
    const fmt = (label: string, meta: { state: string; status: number }) => {
      if (meta.state === "ok") return `${label}: ok`;
      if (meta.state === "missing") return `${label}: missing (404)`;
      if (meta.status === 0) return `${label}: offline`;
      return `${label}: error (${meta.status})`;
    };

    return [
      fmt("client-profiles", profilesMeta),
      fmt("tasks", tasksMeta),
      fmt("process-instances-v2", instancesMeta),
    ].join(" | ");
  }, [profilesMeta, tasksMeta, instancesMeta]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        Reglement Overview
      </div>

      {uiState !== "ready" ? (
        <div>Loading...</div>
      ) : (
        <>
          <div style={{ marginBottom: 12, opacity: 0.85 }}>{healthText}</div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <b>Client profiles</b>
              <div>{profilesCount}</div>
            </div>

            <div>
              <b>Tasks</b>
              <div>{tasksCount}</div>
            </div>

            <div>
              <b>Process instances</b>
              <div>{instancesCount}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}