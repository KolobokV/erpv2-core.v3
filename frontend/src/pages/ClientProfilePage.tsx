import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PageShell } from "../components/PageShell";
import { UpBackBar } from "../components/UpBackBar";
import { ClientTasksSummaryCard } from "../components/ClientTasksSummaryCard";
import ClientCoverageSummaryCard from "../components/ClientCoverageSummaryCard";
import { RiskBadge } from "../v27/RiskBadge";

import type { ClientProfileV27, TaxSystemV27, VatModeV27, LegalEntityTypeV27 } from "../v27/types";
import { deriveReglementV27 } from "../v27/deriveReglement";
import { evaluateClientRiskV27 } from "../v27/riskEngine";
import { getClientFromLocation } from "../v27/clientContext";
import {
  loadClientProfileV27,
  resetClientProfileV27,
  saveClientProfileV27,
  loadMaterializeMetaV27,
  materializeFromDerivedV27
} from "../v27/profileStore";
import { countProcessIntents, clearProcessIntents } from "../v27/processIntentsStore";
import ClientCockpitHeader from "../components/client/ClientCockpitHeader";

function clampInt(v: any, min: number, max: number): number {
  const n = parseInt(String(v || "0"), 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function toggleInArray(arr: number[], x: number): number[] {
  const set = new Set(arr);
  if (set.has(x)) set.delete(x);
  else set.add(x);
  return Array.from(set).sort((a, b) => a - b);
}

function getClientIdSafe(location: { search: string; pathname: string }): string {
  try {
    const sp = new URLSearchParams(location.search || "");
    const fromQuery = (sp.get("client") || sp.get("client_id") || sp.get("cid") || "").trim();
    if (fromQuery) return fromQuery;
  } catch {
    // ignore
  }

  try {
    const v = String(getClientFromLocation(location as any) || "").trim();
    if (v) return v;
  } catch {
    // ignore
  }

  const parts = String(location.pathname || "").split("/").filter(Boolean);
  const idx = parts.indexOf("client-profile");
  if (idx >= 0 && parts[idx + 1]) return String(parts[idx + 1]).trim();

  return "";
}

function makeDefaultClientProfileV27Local(clientId: string): ClientProfileV27 {
  const now = new Date().toISOString();
  return {
    clientId,
    legal: { entityType: "IP", taxSystem: "USN_DR", vatMode: "NONE" },
    employees: { hasPayroll: false, headcount: 0, payrollDates: [] },
    operations: { bankAccounts: 1, cashRegister: false, ofd: false, foreignOps: false },
    specialFlags: { tourismTax: false, excise: false, controlledTransactions: false },
    updatedAtIso: now
  };
}

function normalizeClientProfileV27(input: any, clientId: string): ClientProfileV27 {
  const base = makeDefaultClientProfileV27Local(clientId);
  const obj = input && typeof input === "object" ? input : {};

  const legal = obj.legal && typeof obj.legal === "object" ? obj.legal : {};
  const employees = obj.employees && typeof obj.employees === "object" ? obj.employees : {};
  const operations = obj.operations && typeof obj.operations === "object" ? obj.operations : {};
  const specialFlags = obj.specialFlags && typeof obj.specialFlags === "object" ? obj.specialFlags : {};

  const profile: ClientProfileV27 = {
    clientId: String(obj.clientId || clientId || base.clientId),
    legal: {
      entityType: (legal.entityType as LegalEntityTypeV27) || base.legal.entityType,
      taxSystem: (legal.taxSystem as TaxSystemV27) || base.legal.taxSystem,
      vatMode: (legal.vatMode as VatModeV27) || base.legal.vatMode
    },
    employees: {
      hasPayroll: !!employees.hasPayroll,
      headcount: clampInt(employees.headcount, 0, 5000),
      payrollDates: Array.isArray(employees.payrollDates)
        ? employees.payrollDates.map((x: any) => clampInt(x, 1, 31)).filter((x: number) => x >= 1 && x <= 31)
        : []
    },
    operations: {
      bankAccounts: clampInt(operations.bankAccounts, 0, 50),
      cashRegister: !!operations.cashRegister,
      ofd: !!operations.ofd,
      foreignOps: !!operations.foreignOps
    },
    specialFlags: {
      tourismTax: !!specialFlags.tourismTax,
      excise: !!specialFlags.excise,
      controlledTransactions: !!specialFlags.controlledTransactions
    },
    updatedAtIso: String(obj.updatedAtIso || base.updatedAtIso)
  };

  return profile;
}

const S_CLIENT_CARD = "\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430: ";
const S_DAY = "\u0414\u0435\u043d\u044c";
const S_TASKS = "\u0417\u0430\u0434\u0430\u0447\u0438";
const S_RESET = "\u0421\u0431\u0440\u043e\u0441";
const S_SAVE = "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c";
const S_CTX_REQUIRED = "\u041a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u0435\u043d";
const S_OPEN_WITH_PARAM = "\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u044d\u0442\u0443 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0441 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u043e\u043c ?client=...";
const S_OPEN = "\u041e\u0442\u043a\u0440\u044b\u0442\u044c";
const S_GO_TO_TASKS = "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u0437\u0430\u0434\u0430\u0447\u0430\u043c";

const S_PASSPORT = "\u041f\u0430\u0441\u043f\u043e\u0440\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u0430";
const S_LEGAL = "\u042e\u0440. \u0434\u0430\u043d\u043d\u044b\u0435";
const S_EMPLOYEES = "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438";
const S_OPS = "\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u0438";
const S_FLAGS = "\u0421\u043f\u0435\u0446. \u043f\u0440\u0438\u0437\u043d\u0430\u043a\u0438";
const S_DERIVED = "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435";

const S_TOAST_MISSING_CLIENT = "\u041d\u0435\u0442 \u043a\u043e\u0434\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0432 URL";
const S_TOAST_SAVED = "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e";
const S_TOAST_SAVE_FAILED = "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f";
const S_TOAST_RESET = "\u0421\u0431\u0440\u043e\u0448\u0435\u043d\u043e";
const S_TOAST_RESET_FAILED = "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0431\u0440\u043e\u0441\u0430";

const S_MAT_TASKS = "\u0421\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0438 (\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e)";
const S_RESET_TASKS = "\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0438 (\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e)";
const S_CLEAR_QUEUE = "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432";
const S_TOAST_QUEUE_CLEARED = "\u041e\u0447\u0435\u0440\u0435\u0434\u044c \u043e\u0447\u0438\u0449\u0435\u043d\u0430";
const S_TOAST_MAT_OK = "\u0417\u0430\u0434\u0430\u0447\u0438 \u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u044b (\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e)";
const S_TOAST_MAT_FAILED = "\u041e\u0448\u0438\u0431\u043a\u0430 \u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u0437\u0430\u0434\u0430\u0447";
const S_TOAST_TASKS_RESET_OK = "\u0417\u0430\u0434\u0430\u0447\u0438 \u0441\u0431\u0440\u043e\u0448\u0435\u043d\u044b (\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e)";
const S_TOAST_TASKS_RESET_FAILED = "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0431\u0440\u043e\u0441\u0430 \u0437\u0430\u0434\u0430\u0447";

const S_ENTITY_TYPE = "\u0422\u0438\u043f \u0441\u0443\u0431\u044a\u0435\u043a\u0442\u0430";
const S_TAX_SYSTEM = "\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u043d\u0430\u043b\u043e\u0433\u043e\u043e\u0431\u043b\u043e\u0436\u0435\u043d\u0438\u044f";
const S_VAT_MODE = "\u0420\u0435\u0436\u0438\u043c \u041d\u0414\u0421";

const S_HAS_PAYROLL = "\u0415\u0441\u0442\u044c \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u0430";
const S_HEADCOUNT = "\u0427\u0438\u0441\u043b\u043043\u0435\u043d\u043d\u043e\u0441\u0442\u044c";
const S_PAYROLL_DATES = "\u0414\u043d\u0438 \u0432\u044b\u043f\u043b\u0430\u0442\u044b";

const S_BANK_ACCOUNTS = "\u0420\u0430\u0441\u0447\u0435\u0442\u043d\u044b\u0435 \u0441\u0447\u0435\u0442\u0430";
const S_CASH_REGISTER = "\u041a\u0430\u0441\u0441\u0430";
const S_OFD = "\u041e\u0424\u0414";
const S_FOREIGN_OPS = "\u0412\u043d\u0435\u0448\u043d\u0438\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438";

const S_TOURISM_TAX = "\u0422\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0441\u0431\u043e\u0440";
const S_EXCISE = "\u0410\u043a\u0446\u0438\u0437";
const S_CTRL_TRANS = "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u0435\u043c\u044b\u0435 \u0441\u0434\u0435\u043b\u043a\u0438";

const P_CLIENT_ID = "clientId (e.g. ip_usn_dr)";

export default function ClientProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const clientId = useMemo(() => getClientIdSafe(location as any), [location]);
  const hasClient = useMemo(() => !!(clientId && String(clientId).trim().length > 0), [clientId]);

  const [openClientId, setOpenClientId] = useState<string>("");

  const [profile, setProfile] = useState<ClientProfileV27>(() =>
    normalizeClientProfileV27(loadClientProfileV27(clientId), clientId)
  );

  const [savedAt, setSavedAt] = useState<string>(profile.updatedAtIso);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string>("");

  const [tasksRev, setTasksRev] = useState<number>(0);
  const [tasksMeta, setTasksMeta] = useState<any>(() => loadMaterializeMetaV27(clientId));

  const [intentRev, setIntentRev] = useState<number>(0);
  const intentCount = useMemo(() => countProcessIntents(clientId), [clientId, intentRev]);

  useEffect(() => {
    const loaded = normalizeClientProfileV27(loadClientProfileV27(clientId), clientId);
    setProfile(loaded);
    setSavedAt(loaded.updatedAtIso);

    setTasksMeta(loadMaterializeMetaV27(clientId));
    setTasksRev((x) => x + 1);

    setIntentRev((x) => x + 1);
  }, [clientId]);

  function update(mut: (p: ClientProfileV27) => ClientProfileV27) {
    setProfile((prev) => {
      const next = mut(prev);
      return { ...next };
    });
  }

  const derived = useMemo(() => {
    try {
      return deriveReglementV27(profile);
    } catch (e: any) {
      return { error: String(e?.message || e) };
    }
  }, [profile]);

  const risk = useMemo(() => {
    try {
      return evaluateClientRiskV27(profile, derived as any);
    } catch {
      return { score: 0, label: "risk_error" };
    }
  }, [profile, derived]);

  async function doSave() {
    if (!hasClient) {
      setToast(S_TOAST_MISSING_CLIENT);
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      setSaving(true);
      const fresh = { ...profile, updatedAtIso: new Date().toISOString() };
      saveClientProfileV27(clientId, fresh);
      setProfile(fresh);
      setSavedAt(fresh.updatedAtIso);
      setToast(S_TOAST_SAVED);
      window.setTimeout(() => setToast(""), 1200);
    } catch {
      setToast(S_TOAST_SAVE_FAILED);
      window.setTimeout(() => setToast(""), 1200);
    } finally {
      setSaving(false);
    }
  }

  function doOpenWithClient() {
    const v = String(openClientId || "").trim();
    if (!v) return;
    navigate(`/client-profile?client=${encodeURIComponent(v)}`);
  }

  function doReset() {
    if (!hasClient) {
      setToast(S_TOAST_MISSING_CLIENT);
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      resetClientProfileV27(clientId);
      const fresh = normalizeClientProfileV27(loadClientProfileV27(clientId), clientId);
      setProfile(fresh);
      setSavedAt(fresh.updatedAtIso);
      setToast(S_TOAST_RESET);
      window.setTimeout(() => setToast(""), 1200);

      setTasksMeta(loadMaterializeMetaV27(clientId));
      setTasksRev((x) => x + 1);
    } catch {
      setToast(S_TOAST_RESET_FAILED);
      window.setTimeout(() => setToast(""), 1200);
    }
  }

  function doMaterializeLocalTasks() {
    if (!hasClient) {
      setToast(S_TOAST_MISSING_CLIENT);
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      materializeFromDerivedV27(clientId, derived as any);
      setTasksMeta(loadMaterializeMetaV27(clientId));
      setTasksRev((x) => x + 1);
      setToast(S_TOAST_MAT_OK);
      window.setTimeout(() => setToast(""), 1200);
    } catch {
      setToast(S_TOAST_MAT_FAILED);
      window.setTimeout(() => setToast(""), 1200);
    }
  }

  function doResetLocalTasks() {
    if (!hasClient) {
      setToast(S_TOAST_MISSING_CLIENT);
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      const meta = loadMaterializeMetaV27(clientId);
      if (meta && typeof meta === "object") {
        meta.count = 0;
      }
      setTasksMeta(loadMaterializeMetaV27(clientId));
      setTasksRev((x) => x + 1);
      setToast(S_TOAST_TASKS_RESET_OK);
      window.setTimeout(() => setToast(""), 1200);
    } catch {
      setToast(S_TOAST_TASKS_RESET_FAILED);
      window.setTimeout(() => setToast(""), 1200);
    }
  }

  const title = S_CLIENT_CARD + (clientId || "-");

  return (
    <PageShell>
      <ClientCockpitHeader />
      <UpBackBar
        title={title}
        onUp={() => navigate("/")}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <RiskBadge score={risk.score} label={risk.label} />
            <a className="erp-btn" href={hasClient ? ("/day?client=" + encodeURIComponent(clientId)) : "/day"}>
              {S_DAY}
            </a>
            <a className="erp-btn" href={hasClient ? ("/tasks?client=" + encodeURIComponent(clientId)) : "/tasks"}>
              {S_TASKS}
            </a>
            <button className="erp-btn" onClick={doReset} disabled={saving || !hasClient}>
              {S_RESET}
            </button>
            <button className="erp-btn" onClick={doSave} disabled={saving || !hasClient}>
              {S_SAVE}
            </button>
          </div>
        }
      />

      <div style={{ padding: 12, display: "grid", gap: 12 }}>
        {!hasClient ? (
          <div style={{ border: "1px solid rgba(255,160,80,0.35)", borderRadius: 16, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{S_CTX_REQUIRED}</div>
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 12 }}>{S_OPEN_WITH_PARAM}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={openClientId}
                onChange={(e) => setOpenClientId(e.target.value)}
                placeholder={P_CLIENT_ID}
                style={{ padding: "6px 10px", borderRadius: 12, minWidth: 260, border: "1px solid rgba(15,23,42,0.14)" }}
              />
              <button onClick={doOpenWithClient} className="erp-btn" style={{ padding: "6px 10px" }}>
                {S_OPEN}
              </button>
              <a href="/tasks" className="erp-btn" style={{ padding: "6px 10px", opacity: 0.9 }}>
                {S_GO_TO_TASKS}
              </a>
            </div>
          </div>
        ) : null}

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 260 }}>
              <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 700 }}>{S_PASSPORT}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="erp-chip">{"\u0422\u0438\u043f=" + String(profile?.legal?.entityType || "-")}</span>
                <span className="erp-chip">{"\u041d\u0430\u043b\u043e\u0433=" + String(profile?.legal?.taxSystem || "-")}</span>
                <span className="erp-chip">{"\u041d\u0414\u0421=" + String(profile?.legal?.vatMode || "-")}</span>
                <span className="erp-chip">{"\u0417\u0430\u0440\u043f\u043b\u0430\u0442\u0430=" + String(!!profile?.employees?.hasPayroll)}</span>
                <span className="erp-chip">{"\u0428\u0442\u0430\u0442=" + String(profile?.employees?.headcount ?? 0)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                {"updatedAt=" + String(profile?.updatedAtIso || "-")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="erp-btn" onClick={doMaterializeLocalTasks} disabled={!hasClient}>
                {S_MAT_TASKS}
              </button>
              <button className="erp-btn" onClick={doResetLocalTasks} disabled={!hasClient}>
                {S_RESET_TASKS}
              </button>
              <button
                className="erp-btn"
                onClick={() => {
                  if (!hasClient) return;
                  clearProcessIntents(clientId);
                  setIntentRev((x) => x + 1);
                  setToast(S_TOAST_QUEUE_CLEARED);
                  window.setTimeout(() => setToast(""), 1200);
                }}
                disabled={!hasClient}
              >
                {S_CLEAR_QUEUE}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, opacity: 0.8 }}>
            <span>{"meta.count=" + String(tasksMeta?.count ?? 0)}</span>
            <span>{"meta.last=" + String(tasksMeta?.last_materialize_error ?? "-")}</span>
            <span>{"queue=" + String(intentCount)}</span>
            <span>{"savedAt=" + String(savedAt)}</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ClientTasksSummaryCard clientId={clientId} title={S_TASKS} rev={tasksRev} />
          <ClientCoverageSummaryCard clientId={clientId} title={"\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432 (local)"} rev={tasksRev} />
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{S_LEGAL}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>{S_ENTITY_TYPE}</div>
            <select value={profile.legal.entityType} disabled={!hasClient}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, entityType: e.target.value as LegalEntityTypeV27 } }))}>
              <option value="IP">IP</option>
              <option value="OOO">OOO</option>
            </select>

            <div>{S_TAX_SYSTEM}</div>
            <select value={profile.legal.taxSystem} disabled={!hasClient}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, taxSystem: e.target.value as TaxSystemV27 } }))}>
              <option value="USN_DR">USN DR</option>
              <option value="USN_DO">USN DO</option>
              <option value="OSNO">OSNO</option>
              <option value="PATENT">PATENT</option>
            </select>

            <div>{S_VAT_MODE}</div>
            <select value={profile.legal.vatMode} disabled={!hasClient}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, vatMode: e.target.value as VatModeV27 } }))}>
              <option value="NONE">NONE</option>
              <option value="VAT_5">VAT 5</option>
              <option value="VAT_7">VAT 7</option>
              <option value="VAT_20">VAT 20</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{S_EMPLOYEES}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>{S_HAS_PAYROLL}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.employees.hasPayroll}
              onChange={(e) => update((p) => ({ ...p, employees: { ...p.employees, hasPayroll: e.target.checked } }))} />

            <div>{S_HEADCOUNT}</div>
            <input type="number" disabled={!hasClient} value={profile.employees.headcount}
              onChange={(e) => update((p) => ({ ...p, employees: { ...p.employees, headcount: clampInt(e.target.value, 0, 5000) } }))} />

            <div>{S_PAYROLL_DATES}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: hasClient ? 1 : 0.6 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const on = profile.employees.payrollDates.includes(day);
                return (
                  <button key={day} disabled={!hasClient} style={{ opacity: on ? 1 : 0.4 }}
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        employees: { ...p.employees, payrollDates: toggleInArray(p.employees.payrollDates, day) }
                      }))
                    }>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{S_OPS}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>{"\u0420\u0430\u0441\u0447\u0435\u0442\u043d\u044b\u0435 \u0441\u0447\u0435\u0442\u0430"}</div>
            <input type="number" disabled={!hasClient} value={profile.operations.bankAccounts}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, bankAccounts: clampInt(e.target.value, 0, 50) } }))} />

            <div>{S_CASH_REGISTER}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.operations.cashRegister}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, cashRegister: e.target.checked } }))} />

            <div>{S_OFD}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.operations.ofd}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, ofd: e.target.checked } }))} />

            <div>{S_FOREIGN_OPS}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.operations.foreignOps}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, foreignOps: e.target.checked } }))} />
          </div>
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{S_FLAGS}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>{S_TOURISM_TAX}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.specialFlags.tourismTax}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, tourismTax: e.target.checked } }))} />

            <div>{S_EXCISE}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.specialFlags.excise}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, excise: e.target.checked } }))} />

            <div>{S_CTRL_TRANS}</div>
            <input type="checkbox" disabled={!hasClient} checked={!!profile.specialFlags.controlledTransactions}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, controlledTransactions: e.target.checked } }))} />
          </div>

          <div style={{ marginTop: 12 }}>
            <details>
              <summary style={{ cursor: "pointer" }}>{S_DERIVED}</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(derived, null, 2)}</pre>
            </details>
          </div>
        </div>

        {toast ? <div style={{ opacity: 0.85, fontSize: 12 }}>toast: {toast}</div> : null}
      </div>
    </PageShell>
  );
}