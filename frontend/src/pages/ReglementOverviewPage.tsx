import React, { useEffect, useMemo, useState } from "react";

import {
  fetchClientProfilesSafe,
  fetchTasksSafe,
  fetchProcessInstancesV2Safe,
} from "../api";

type UiState = "idle" | "loading" | "ready";

type MetaShape = { state: string; status: number };

function safeMeta(resp: any): MetaShape {
  const status = typeof resp?.status === "number" ? resp.status : 0;
  const st = String(resp?.meta?.state ?? "").trim();
  if (st) return { state: st, status };
  if (status === 0) return { state: "offline", status: 0 };
  if (status === 404) return { state: "missing", status };
  return { state: "error", status };
}

export default function ReglementOverviewPage() {
  const [uiState, setUiState] = useState<UiState>("idle");

  const [profilesMeta, setProfilesMeta] = useState<MetaShape>({ state: "idle", status: 0 });
  const [tasksMeta, setTasksMeta] = useState<MetaShape>({ state: "idle", status: 0 });
  const [instancesMeta, setInstancesMeta] = useState<MetaShape>({ state: "idle", status: 0 });

  const [profilesCount, setProfilesCount] = useState<number>(0);
  const [tasksCount, setTasksCount] = useState<number>(0);
  const [instancesCount, setInstancesCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setUiState("loading");

      let p: any = null;
      let t: any = null;
      let i: any = null;

      try {
        [p, t, i] = await Promise.all([
          fetchClientProfilesSafe(),
          fetchTasksSafe(),
          fetchProcessInstancesV2Safe(),
        ]);
      } catch (e) {
        if (cancelled) return;
        setProfilesMeta({ state: "error", status: 0 });
        setTasksMeta({ state: "error", status: 0 });
        setInstancesMeta({ state: "error", status: 0 });
        setProfilesCount(0);
        setTasksCount(0);
        setInstancesCount(0);
        setUiState("ready");
        return;
      }

      if (cancelled) return;

      const pm = safeMeta(p);
      const tm = safeMeta(t);
      const im = safeMeta(i);

      setProfilesMeta(pm);
      setTasksMeta(tm);
      setInstancesMeta(im);

      const pItems = p?.data?.items;
      const tTasks = t?.data?.tasks;
      const iItems = i?.data?.items;

      setProfilesCount(Array.isArray(pItems) ? pItems.length : 0);
      setTasksCount(Array.isArray(tTasks) ? tTasks.length : 0);
      setInstancesCount(Array.isArray(iItems) ? iItems.length : 0);

      setUiState("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const healthText = useMemo(() => {
    const fmt = (label: string, meta: MetaShape) => {
      if (meta.state === "ok") return `${label}: ok`;
      if (meta.state === "missing") return `${label}: missing (404)`;
      if (meta.state === "offline" || meta.status === 0) return `${label}: offline`;
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