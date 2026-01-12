import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../ux/clientCreate.css";

import OnboardingResultPanel from "../components/client/OnboardingResultPanel";
import ReglementPreviewPanel from "../components/client/ReglementPreviewPanel";
import { addOnboardingClient, setLastActiveClient } from "../lib/onboardingLocal";
import { saveIntake } from "../lib/intakeStore";
import { derivePreviewViaBackend, PreviewItem as ApiPreviewItem } from "../lib/onboardingApi";

type TaxMode = "usn_income" | "usn_income_expense" | "vat";

type IntakeData = {
  clientId: string;
  taxMode: TaxMode;
  employees: number;
  payrollDay1: number;
  payrollDay2: number;
};

type OnboardingResult = { clientId: string; events: number; tasks: number };
type PreviewItem = { title: string; due: string };

function tFactory() {
  const dict: Record<string, string> = {
    kicker: "\u041a\u043b\u0438\u0435\u043d\u0442 \u00b7 \u041e\u043d\u0431\u043e\u0440\u0434\u0438\u043d\u0433",
    title: "\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
    lead:
      "\u0410\u043d\u043a\u0435\u0442\u0430 \u2192 \u043f\u0440\u0435\u0432\u044c\u044e \u0440\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442\u0430/\u0437\u0430\u0434\u0430\u0447 \u2192 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435.",
    back: "\u041d\u0430\u0437\u0430\u0434",
    basic: "\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435",
    payroll: "\u0417\u0430\u0440\u043f\u043b\u0430\u0442\u0430",
    preview: "\u041f\u0440\u0435\u0432\u044c\u044e",
    status: "\u0421\u0442\u0430\u0442\u0443\u0441",
    summary: "\u0421\u0432\u043e\u0434\u043a\u0430",
    clientId: "\u041a\u043e\u0434 \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
    clientIdHint:
      "\u041b\u0430\u0442\u0438\u043d\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044b, _ , -. \u041f\u0440\u0438\u043c\u0435\u0440: demo_client",
    normalized: "\u041d\u043e\u0440\u043c\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u043e",
    taxMode: "\u0420\u0435\u0436\u0438\u043c",
    employees: "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438",
    payroll1: "\u0414\u0435\u043d\u044c \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u044b #1",
    payroll2: "\u0414\u0435\u043d\u044c \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u044b #2",
    generate: "\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u0435\u0432\u044c\u044e",
    generating: "\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f...",
    emptyPreview: "\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u043f\u0440\u0435\u0432\u044c\u044e, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c.",
    confirm: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0438 \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c",
    day: "\u0414\u0435\u043d\u044c",
    tasks: "\u0417\u0430\u0434\u0430\u0447\u0438",
    hintBackend: "\u0411\u044d\u043a\u0435\u043d\u0434 derive: /api/onboarding/derive-preview (fallback \u2014 local).",
    okBackend: "\u041f\u0440\u0435\u0432\u044c\u044e: backend",
    okLocal: "\u041f\u0440\u0435\u0432\u044c\u044e: local",
    invalid: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0430\u043d\u043a\u0435\u0442\u0443.",
  };
  return (k: string) => dict[k] ?? k;
}

function normalizeSlug(v: string): string {
  const s0 = (v || "").trim().toLowerCase();
  const s1 = s0.replace(/[^a-z0-9_-]+/g, "_");
  const s2 = s1.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return s2;
}

function clampInt(v: string, min: number, max: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function localBuildPreview(data: IntakeData): { result: OnboardingResult; items: PreviewItem[] } {
  const base = [{ title: "Bank statement request", due: "2026-01-02" }];
  const payroll =
    data.employees > 0
      ? [
          { title: "Payroll processing", due: "2026-01-" + String(data.payrollDay1).padStart(2, "0") },
          { title: "Payroll processing", due: "2026-01-" + String(data.payrollDay2).padStart(2, "0") },
        ]
      : [];
  const tax = data.taxMode === "vat" ? [{ title: "VAT declaration", due: "2026-01-25" }] : [{ title: "USN advance payment", due: "2026-01-28" }];
  const items = [...base, ...payroll, ...tax].slice(0, 10);
  return { result: { clientId: data.clientId, events: items.length, tasks: Math.max(1, Math.floor(items.length / 2)) }, items };
}

export default function ClientCreatePage() {
  const t = useMemo(() => tFactory(), []);
  const nav = useNavigate();

  const [clientIdRaw, setClientIdRaw] = useState("demo_client");
  const clientId = useMemo(() => normalizeSlug(clientIdRaw), [clientIdRaw]);

  const [taxMode, setTaxMode] = useState<TaxMode>("usn_income_expense");
  const [employeesRaw, setEmployeesRaw] = useState("0");
  const employees = useMemo(() => clampInt(employeesRaw, 0, 500), [employeesRaw]);

  const [payroll1Raw, setPayroll1Raw] = useState("10");
  const [payroll2Raw, setPayroll2Raw] = useState("25");
  const payrollDay1 = useMemo(() => clampInt(payroll1Raw, 1, 31), [payroll1Raw]);
  const payrollDay2 = useMemo(() => clampInt(payroll2Raw, 1, 31), [payroll2Raw]);

  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [status, setStatus] = useState<string>("");

  const dayUrl = useMemo(() => (result ? "/day?client=" + encodeURIComponent(result.clientId) : "/day"), [result]);
  const tasksUrl = useMemo(() => (result ? "/tasks?client=" + encodeURIComponent(result.clientId) : "/tasks"), [result]);

  const canGenerate = useMemo(() => {
    if (!clientId) return false;
    return true;
  }, [clientId]);

  const generate = async () => {
    if (!canGenerate) {
      setStatus(t("invalid"));
      return;
    }

    const intake: IntakeData = {
      clientId,
      taxMode,
      employees,
      payrollDay1,
      payrollDay2,
    };

    setStatus(t("generating"));

    try {
      const out = await derivePreviewViaBackend(intake as any);
      setResult({ clientId: out.clientId, events: out.events, tasks: out.tasks });
      setPreview((out.items || []).map((x: ApiPreviewItem) => ({ title: x.title, due: x.due })));
      setStatus(t("okBackend"));
      return;
    } catch {
      const built = localBuildPreview(intake);
      setResult(built.result);
      setPreview(built.items);
      setStatus(t("okLocal"));
    }
  };

  const confirm = () => {
    if (!result) return;

    saveIntake({
      clientId: result.clientId,
      taxMode,
      employees,
      payrollDay1,
      payrollDay2,
    });

    addOnboardingClient(result.clientId);
    setLastActiveClient(result.clientId);

    nav("/client-profile?client=" + encodeURIComponent(result.clientId));
  };

  return (
    <div className="erp-page erp-onboarding-page erp-client-edit-page">
      <div className="erp-page-inner">
        <div className="erp-page-head erp-client-edit-head">
          <div className="min-w-0">
            <div className="erp-kicker">{t("kicker")}</div>
            <div className="erp-h1">{t("title")}</div>
            <div className="text-xs text-slate-500">{t("lead")}</div>
            <div className="text-xs text-slate-500">{t("hintBackend")}</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button className="erp-btn" type="button" onClick={() => nav(-1)}>
              {t("back")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="lg:col-span-2 space-y-2">
            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("basic")}</div>

              <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="erp-field md:col-span-2">
                  <div className="erp-label">{t("clientId")}</div>
                  <input className="erp-input" value={clientIdRaw} onChange={(e) => setClientIdRaw(e.target.value)} placeholder={"demo_client"} />
                  <div className="text-xs text-slate-500">{t("clientIdHint")}</div>
                  <div className="text-xs text-slate-500">
                    {t("normalized")}: <span className="font-mono">{clientId || "\u2014"}</span>
                  </div>
                </div>

                <div className="erp-field md:col-span-2">
                  <div className="erp-label">{t("taxMode")}</div>
                  <select className="erp-input" value={taxMode} onChange={(e) => setTaxMode(e.target.value as TaxMode)}>
                    <option value="usn_income_expense">{"USN (income-expense)"}</option>
                    <option value="usn_income">{"USN (income)"}</option>
                    <option value="vat">{"VAT"}</option>
                  </select>
                </div>

                <div className="erp-field">
                  <div className="erp-label">{t("employees")}</div>
                  <input className="erp-input" value={employeesRaw} onChange={(e) => setEmployeesRaw(e.target.value)} inputMode="numeric" />
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <button className="erp-btn erp-btn-primary" type="button" onClick={generate} disabled={!canGenerate}>
                  {t("generate")}
                </button>
                <div className="text-xs text-slate-500">{status || "\u2014"}</div>
              </div>
            </div>

            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("payroll")}</div>

              <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="erp-field">
                  <div className="erp-label">{t("payroll1")}</div>
                  <input className="erp-input" value={payroll1Raw} onChange={(e) => setPayroll1Raw(e.target.value)} inputMode="numeric" />
                </div>
                <div className="erp-field">
                  <div className="erp-label">{t("payroll2")}</div>
                  <input className="erp-input" value={payroll2Raw} onChange={(e) => setPayroll2Raw(e.target.value)} inputMode="numeric" />
                </div>
              </div>
            </div>

            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("preview")}</div>

              <div className="mt-1">
                {result ? (
                  <>
                    <div className="erp-onboarding-preview">
                      <OnboardingResultPanel clientId={result.clientId} events={result.events} tasks={result.tasks} />
                    </div>
                    <div className="mt-1">
                      <ReglementPreviewPanel items={preview} />
                    </div>
                  </>
                ) : (
                  <div className="erp-muted">{t("emptyPreview")}</div>
                )}
              </div>

              {result ? (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <button className="erp-btn erp-btn-primary" type="button" onClick={confirm}>
                    {t("confirm")}
                  </button>
                  <a className="erp-btn" href={dayUrl}>
                    {t("day")}
                  </a>
                  <a className="erp-btn" href={tasksUrl}>
                    {t("tasks")}
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-2">
            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("status")}</div>
              <div className="mt-1 text-sm text-slate-600">{status || "\u2014"}</div>
            </div>

            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("summary")}</div>

              <div className="mt-1 space-y-2">
                <div className="erp-row2">
                  <div className="erp-row2-k">{t("clientId")}</div>
                  <div className="erp-row2-v font-mono">{clientId || "\u2014"}</div>
                </div>
                <div className="erp-row2">
                  <div className="erp-row2-k">{t("taxMode")}</div>
                  <div className="erp-row2-v">{taxMode}</div>
                </div>
                <div className="erp-row2">
                  <div className="erp-row2-k">{t("employees")}</div>
                  <div className="erp-row2-v">{String(employees)}</div>
                </div>
                <div className="erp-row2">
                  <div className="erp-row2-k">{"Payroll"}</div>
                  <div className="erp-row2-v">{String(payrollDay1) + ", " + String(payrollDay2)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
