import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingResultPanel from "../components/client/OnboardingResultPanel";
import ReglementPreviewPanel from "../components/client/ReglementPreviewPanel";
import ClientIntakeForm, { IntakeData } from "../components/client/ClientIntakeForm";
import { addOnboardingClient, setLastActiveClient } from "../lib/onboardingLocal";
import { saveIntake } from "../lib/intakeStore";
import { derivePreviewViaBackend, PreviewItem as ApiPreviewItem } from "../lib/onboardingApi";

type OnboardingResult = { clientId: string; events: number; tasks: number };
type PreviewItem = { title: string; due: string };

function localBuildPreview(data: IntakeData): { result: OnboardingResult; items: PreviewItem[] } {
  const base = [{ title: "Bank statement request", due: "2026-01-02" }];
  const payroll = data.employees > 0
    ? [
        { title: "Payroll processing", due: "2026-01-" + String(data.payrollDay1).padStart(2, "0") },
        { title: "Payroll processing", due: "2026-01-" + String(data.payrollDay2).padStart(2, "0") }
      ]
    : [];
  const tax = data.taxMode === "vat"
    ? [{ title: "VAT declaration", due: "2026-01-25" }]
    : [{ title: "USN advance payment", due: "2026-01-28" }];
  const items = [...base, ...payroll, ...tax].slice(0, 10);
  return { result: { clientId: data.clientId, events: items.length, tasks: Math.max(1, Math.floor(items.length / 2)) }, items };
}

export default function ClientCreatePage() {
  const nav = useNavigate();

  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [status, setStatus] = useState<string>("");

  const dayUrl = useMemo(() => result ? "/day?client=" + encodeURIComponent(result.clientId) : "/day", [result]);
  const tasksUrl = useMemo(() => result ? "/tasks?client=" + encodeURIComponent(result.clientId) : "/tasks", [result]);

  const generate = async (data: IntakeData) => {
    setIntake(data);
    setStatus("Generating preview...");

    try {
      const out = await derivePreviewViaBackend(data);
      setResult({ clientId: out.clientId, events: out.events, tasks: out.tasks });
      setPreview((out.items || []).map((x: ApiPreviewItem) => ({ title: x.title, due: x.due })));
      setStatus("Preview from backend");
      return;
    } catch (e) {
      const built = localBuildPreview(data);
      setResult(built.result);
      setPreview(built.items);
      setStatus("Backend unavailable, using local preview");
    }
  };

  const confirm = () => {
    if (!result || !intake) return;

    saveIntake({
      clientId: intake.clientId,
      taxMode: intake.taxMode,
      employees: intake.employees,
      payrollDay1: intake.payrollDay1,
      payrollDay2: intake.payrollDay2
    });

    addOnboardingClient(result.clientId);
    setLastActiveClient(result.clientId);

    nav("/client-profile?client=" + encodeURIComponent(result.clientId));
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Client Onboarding</h2>

      <div style={{ marginTop: 8, opacity: 0.75 }}>
        Backend derive: /api/onboarding/derive-preview (fallback to local preview).
      </div>

      <div style={{ marginTop: 12 }}>
        <ClientIntakeForm onSubmit={generate} />
      </div>

      {status ? <div style={{ marginTop: 10, opacity: 0.8 }}>{status}</div> : null}

      <div style={{ marginTop: 16 }}>
        {result ? (
          <>
            <OnboardingResultPanel clientId={result.clientId} events={result.events} tasks={result.tasks} />
            <div style={{ marginTop: 12 }}>
              <ReglementPreviewPanel items={preview} />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={confirm} style={{ padding: "8px 12px" }}>
                Confirm & open profile
              </button>
              <a href={dayUrl}>Day</a>
              <a href={tasksUrl}>Tasks</a>
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.7 }}>Generate preview to continue.</div>
        )}
      </div>
    </div>
  );
}