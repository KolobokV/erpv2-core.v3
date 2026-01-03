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

function decodeUnicodeEscapes(input: any): string {
  const s = String(input ?? "");
  // decode sequences like "\u0417" (backslash-u) into actual chars
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    const code = parseInt(hex, 16);
    if (!Number.isFinite(code)) return _;
    return String.fromCharCode(code);
  });
}

function getClientIdSafe(location: { search: string; pathname: string }): string {
  try {
    const sp = new URLSearchParams(location.search || "");
    const fromQuery =
      (sp.get("client") || sp.get("client_id") || sp.get("cid") || "").trim();
    if (fromQuery) return fromQuery;
  } catch {
    // ignore
  }

  // fallback to old helper (kept for compatibility)
  try {
    const v = String(getClientFromLocation(location as any) || "").trim();
    if (v) return v;
  } catch {
    // ignore
  }

  // last resort: parse from path like /client-profile/<id>
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
    } catch (e: any) {
      return { score: 0, label: "risk_error" };
    }
  }, [profile, derived]);

  async function doSave() {
    if (!hasClient) {
      setToast("Missing client in URL");
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      setSaving(true);
      const fresh = { ...profile, updatedAtIso: new Date().toISOString() };
      saveClientProfileV27(clientId, fresh);
      setProfile(fresh);
      setSavedAt(fresh.updatedAtIso);
      setToast("Saved");
      window.setTimeout(() => setToast(""), 1200);
    } catch (e: any) {
      setToast("Save failed");
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
      setToast("Missing client in URL");
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      resetClientProfileV27(clientId);
      const fresh = normalizeClientProfileV27(loadClientProfileV27(clientId), clientId);
      setProfile(fresh);
      setSavedAt(fresh.updatedAtIso);
      setToast("Reset");
      window.setTimeout(() => setToast(""), 1200);

      setTasksMeta(loadMaterializeMetaV27(clientId));
      setTasksRev((x) => x + 1);
    } catch (e: any) {
      setToast("Reset failed");
      window.setTimeout(() => setToast(""), 1200);
    }
  }

  function doMaterializeLocalTasks() {
    if (!hasClient) {
      setToast("Missing client in URL");
      window.setTimeout(() => setToast(""), 1200);
      return;
    }

    try {
      materializeFromDerivedV27(clientId, derived as any);
      setTasksMeta(loadMaterializeMetaV27(clientId));
      setTasksRev((x) => x + 1);
      setToast("Materialized tasks (local)");
      window.setTimeout(() => setToast(""), 1200);
    } catch (e: any) {
      setToast("Materialize failed");
      window.setTimeout(() => setToast(""), 1200);
    }
  }

  function doResetLocalTasks() {
    if (!hasClient) {
      setToast("Missing client in URL");
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
      setToast("Tasks reset (local)");
      window.setTimeout(() => setToast(""), 1200);
    } catch (e: any) {
      setToast("Reset tasks failed");
      window.setTimeout(() => setToast(""), 1200);
    }
  }

  const sClientCard = decodeUnicodeEscapes("\\u041A\\u0430\\u0440\\u0442\\u043E\\u0447\\u043A\\u0430 \\u043A\\u043B\\u0438\\u0435\\u043D\\u0442\\u0430: ");
  const sDay = decodeUnicodeEscapes("\\u0414\\u0435\\u043D\\u044C");
  const sTasks = decodeUnicodeEscapes("\\u0417\\u0430\\u0434\\u0430\\u0447\\u0438");
  const sReset = decodeUnicodeEscapes("\\u0421\\u0431\\u0440\\u043E\\u0441");
  const sSave = decodeUnicodeEscapes("\\u0421\\u043E\\u0445\\u0440\\u0430\\u043D\\u0438\\u0442\\u044C");
  const sCtxReq = decodeUnicodeEscapes("\\u041A\\u043E\\u043D\\u0442\\u0435\\u043A\\u0441\\u0442 \\u043A\\u043B\\u0438\\u0435\\u043D\\u0442\\u0430 \\u043E\\u0431\\u044F\\u0437\\u0430\\u0442\\u0435\\u043B\\u0435\\u043D");
  const sPassport = decodeUnicodeEscapes("\\u041F\\u0430\\u0441\\u043F\\u043E\\u0440\\u0442 \\u043A\\u043B\\u0438\\u0435\\u043D\\u0442\\u0430");
  const sLegal = decodeUnicodeEscapes("\\u042E\\u0440. \\u0434\\u0430\\u043D\\u043D\\u044B\\u0435");
  const sEmployees = decodeUnicodeEscapes("\\u0421\\u043E\\u0442\\u0440\\u0443\\u0434\\u043D\\u0438\\u043A\\u0438");
  const sOps = decodeUnicodeEscapes("\\u041E\\u043F\\u0435\\u0440\\u0430\\u0446\\u0438\\u0438");
  const sFlags = decodeUnicodeEscapes("\\u0421\\u043F\\u0435\\u0446. \\u043F\\u0440\\u0438\\u0437\\u043D\\u0430\\u043A\\u0438");
  const sDerived = decodeUnicodeEscapes("\\u041F\\u0440\\u043E\\u0438\\u0437\\u0432\\u043E\\u0434\\u043D\\u044B\\u0435 \\u0434\\u0430\\u043D\\u043D\\u044B\\u0435");

  return (
    <PageShell>
      <ClientCockpitHeader />
      <UpBackBar
        title={sClientCard + (clientId || "-")}
        onUp={() => navigate("/")}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <RiskBadge score={risk.score} label={risk.label} />
            <a className="erp-btn" href={hasClient ? ("/day?client=" + encodeURIComponent(clientId)) : "/day"}>
              {sDay}
            </a>
            <a className="erp-btn" href={hasClient ? ("/tasks?client=" + encodeURIComponent(clientId)) : "/tasks"}>
              {sTasks}
            </a>
            <button className="erp-btn" onClick={doReset} disabled={saving || !hasClient}>
              {sReset}
            </button>
            <button className="erp-btn" onClick={doSave} disabled={saving || !hasClient}>
              {sSave}
            </button>
          </div>
        }
      />

      <div style={{ padding: 12, display: "grid", gap: 12 }}>
        {!hasClient ? (
          <div style={{ border: "1px solid rgba(255,160,80,0.35)", borderRadius: 16, padding: 12 }}>
            <div style={{ fontWeight: 800 }}>{sCtxReq}</div>
            <div style={{ marginTop: 6, opacity: 0.85, fontSize: 12 }}>
              {decodeUnicodeEscapes("\\u041E\\u0442\\u043A\\u0440\\u043E\\u0439\\u0442\\u0435 \\u044D\\u0442\\u0443 \\u0441\\u0442\\u0440\\u0430\\u043D\\u0438\\u0446\\u0443 \\u0441 \\u043F\\u0430\\u0440\\u0430\\u043C\\u0435\\u0442\\u0440\\u043E\\u043C ?client=...")}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={openClientId}
                onChange={(e) => setOpenClientId(e.target.value)}
                placeholder="clientId (e.g. ip_usn_dr)"
                style={{ padding: "6px 10px", borderRadius: 12, minWidth: 260, border: "1px solid rgba(15,23,42,0.14)" }}
              />
              <button onClick={doOpenWithClient} className="erp-btn" style={{ padding: "6px 10px" }}>
                {decodeUnicodeEscapes("\\u041E\\u0442\\u043A\\u0440\\u044B\\u0442\\u044C")}
              </button>
              <a href="/tasks" className="erp-btn" style={{ padding: "6px 10px", opacity: 0.9 }}>
                {decodeUnicodeEscapes("\\u041F\\u0435\\u0440\\u0435\\u0439\\u0442\\u0438 \\u043A \\u0437\\u0430\\u0434\\u0430\\u0447\\u0430\\u043C")}
              </a>
            </div>
          </div>
        ) : null}

        <div
          style={{
            border: "1px solid rgba(15,23,42,0.12)",
            borderRadius: 16,
            padding: 12,
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 260 }}>
              <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 700 }}>{sPassport}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="erp-chip">{"entity=" + String(profile?.legal?.entityType || "-")}</span>
                <span className="erp-chip">{"tax=" + String(profile?.legal?.taxSystem || "-")}</span>
                <span className="erp-chip">{"vat=" + String(profile?.legal?.vatMode || "-")}</span>
                <span className="erp-chip">{"payroll=" + String(!!profile?.employees?.hasPayroll)}</span>
                <span className="erp-chip">{"headcount=" + String(profile?.employees?.headcount ?? 0)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                {"updatedAt=" + String(profile?.updatedAtIso || "-")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="erp-btn" onClick={doMaterializeLocalTasks} disabled={!hasClient}>
                {"Materialize tasks (local)"}
              </button>
              <button className="erp-btn" onClick={doResetLocalTasks} disabled={!hasClient}>
                {"Reset tasks (local)"}
              </button>
              <button
                className="erp-btn"
                onClick={() => {
                  if (!hasClient) return;
                  clearProcessIntents(clientId);
                  setIntentRev((x) => x + 1);
                  setToast("Queue cleared");
                  window.setTimeout(() => setToast(""), 1200);
                }}
                disabled={!hasClient}
              >
                {"Clear process queue"}
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
          <ClientTasksSummaryCard clientId={clientId} title={decodeUnicodeEscapes("\\u0417\\u0430\\u0434\\u0430\\u0447\\u0438")} rev={tasksRev} />
          <ClientCoverageSummaryCard
            clientId={clientId}
            title={decodeUnicodeEscapes("\\u041F\\u043E\\u043A\\u0440\\u044B\\u0442\\u0438\\u0435 \\u043F\\u0440\\u043E\\u0446\\u0435\\u0441\\u0441\\u043E\\u0432 (local)")}
            rev={tasksRev}
          />
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{sLegal}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Entity type</div>
            <select
              value={profile.legal.entityType}
              disabled={!hasClient}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, entityType: e.target.value as LegalEntityTypeV27 } }))}
            >
              <option value="IP">IP</option>
              <option value="OOO">OOO</option>
            </select>

            <div>Tax system</div>
            <select
              value={profile.legal.taxSystem}
              disabled={!hasClient}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, taxSystem: e.target.value as TaxSystemV27 } }))}
            >
              <option value="USN_DR">USN DR</option>
              <option value="USN_DO">USN DO</option>
              <option value="OSNO">OSNO</option>
              <option value="PATENT">PATENT</option>
            </select>

            <div>VAT mode</div>
            <select
              value={profile.legal.vatMode}
              disabled={!hasClient}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, vatMode: e.target.value as VatModeV27 } }))}
            >
              <option value="NONE">NONE</option>
              <option value="VAT_5">VAT 5</option>
              <option value="VAT_7">VAT 7</option>
              <option value="VAT_20">VAT 20</option>
            </select>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{sEmployees}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Has payroll</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.employees.hasPayroll}
              onChange={(e) => update((p) => ({ ...p, employees: { ...p.employees, hasPayroll: e.target.checked } }))}
            />

            <div>Headcount</div>
            <input
              type="number"
              disabled={!hasClient}
              value={profile.employees.headcount}
              onChange={(e) => update((p) => ({ ...p, employees: { ...p.employees, headcount: clampInt(e.target.value, 0, 5000) } }))}
            />

            <div>Payroll dates</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: hasClient ? 1 : 0.6 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const on = profile.employees.payrollDates.includes(day);
                return (
                  <button
                    key={day}
                    disabled={!hasClient}
                    style={{ opacity: on ? 1 : 0.4 }}
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        employees: { ...p.employees, payrollDates: toggleInArray(p.employees.payrollDates, day) }
                      }))
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{sOps}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Bank accounts</div>
            <input
              type="number"
              disabled={!hasClient}
              value={profile.operations.bankAccounts}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, bankAccounts: clampInt(e.target.value, 0, 50) } }))}
            />

            <div>Cash register</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.operations.cashRegister}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, cashRegister: e.target.checked } }))}
            />

            <div>OFD</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.operations.ofd}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, ofd: e.target.checked } }))}
            />

            <div>Foreign ops</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.operations.foreignOps}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, foreignOps: e.target.checked } }))}
            />
          </div>
        </div>

        <div style={{ border: "1px solid rgba(15,23,42,0.12)", borderRadius: 16, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{sFlags}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Tourism tax</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.specialFlags.tourismTax}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, tourismTax: e.target.checked } }))}
            />

            <div>Excise</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.specialFlags.excise}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, excise: e.target.checked } }))}
            />

            <div>Controlled transactions</div>
            <input
              type="checkbox"
              disabled={!hasClient}
              checked={!!profile.specialFlags.controlledTransactions}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, controlledTransactions: e.target.checked } }))}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <details>
              <summary style={{ cursor: "pointer" }}>{sDerived}</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(derived, null, 2)}</pre>
            </details>
          </div>
        </div>

        {toast ? (
          <div style={{ opacity: 0.85, fontSize: 12 }}>
            toast: {toast}
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}