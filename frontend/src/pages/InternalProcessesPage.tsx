import { useEffect, useState } from "react";
import { apiGetJson } from "../api";

type ProcessInstance = {
  id?: string;
  clientId?: string;
  name?: string;
  status?: string;
  steps?: any;
};

function normalizeSteps(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  if (typeof raw === "object") return Object.values(raw);
  return [];
}

function instanceHasRisk(instance: ProcessInstance): boolean {
  const steps = normalizeSteps(instance.steps);
  return steps.some((s) => s?.risk === true || s?.status === "risk");
}

export default function InternalProcessesPage() {
  const [instances, setInstances] = useState<ProcessInstance[]>([]);

  useEffect(() => {
    apiGetJson("/api/internal/process-instances-v2")
      .then(setInstances)
      .catch((e) => console.error("Failed to load process instances", e));
  }, []);

  return (
    <div className="internal-processes-page">
      <h1>Internal Processes</h1>

      {instances.map((inst, index) => (
        <div
          key={`${inst.id ?? "noid"}_${index}`}
          className={
            "process-instance " + (instanceHasRisk(inst) ? "has-risk" : "")
          }
        >
          <div className="process-title">{inst.name ?? "Unnamed process"}</div>
          <div className="process-status">{inst.status ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}