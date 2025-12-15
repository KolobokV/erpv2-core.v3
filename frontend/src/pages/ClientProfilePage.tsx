import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PageShell } from "../components/PageShell";
import { UpBackBar } from "../components/UpBackBar";
import { ClientTasksSummaryCard } from "../components/ClientTasksSummaryCard";
import { RiskBadge } from "../v27/RiskBadge";

import type { ClientProfileV27, TaxSystemV27, VatModeV27, LegalEntityTypeV27 } from "../v27/types";
import { deriveReglementV27 } from "../v27/deriveReglement";
import { evaluateClientRiskV27 } from "../v27/riskEngine";
import { getClientFromLocation } from "../v27/clientContext";
import { loadClientProfileV27, resetClientProfileV27, saveClientProfileV27 } from "../v27/profileStore";

function clampInt(x: any, min: number, max: number): number {
  const n = typeof x === "number" ? x : parseInt(String(x ?? ""), 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
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

  const taxSystem: TaxSystemV27 =
    legal.taxSystem === "USN_DR" || legal.taxSystem === "USN_DO" || legal.taxSystem === "OSNO"
      ? legal.taxSystem
      : base.legal.taxSystem;

  const entityType: LegalEntityTypeV27 =
    legal.entityType === "IP" || legal.entityType === "OOO" ? legal.entityType : base.legal.entityType;

  const vatMode: VatModeV27 =
    legal.vatMode === "NONE" || legal.vatMode === "VAT_5" || legal.vatMode === "VAT_20"
      ? legal.vatMode
      : base.legal.vatMode;

  const headcount = clampInt(employees.headcount, 0, 5000);
  const payrollDatesRaw = Array.isArray(employees.payrollDates) ? employees.payrollDates : base.employees.payrollDates;
  const payrollDates = payrollDatesRaw.map((n: any) => clampInt(n, 1, 31)).filter((n: number) => Number.isFinite(n));
  const hasPayroll = !!employees.hasPayroll;

  const bankAccounts = clampInt(operations.bankAccounts, 0, 50);
  const cashRegister = !!operations.cashRegister;
  const ofd = !!operations.ofd;
  const foreignOps = !!operations.foreignOps;

  const tourismTax = !!specialFlags.tourismTax;
  const excise = !!specialFlags.excise;
  const controlledTransactions = !!specialFlags.controlledTransactions;

  const updatedAtIso =
    typeof obj.updatedAtIso === "string" && obj.updatedAtIso.trim().length > 0
      ? obj.updatedAtIso
      : base.updatedAtIso;

  return {
    clientId,
    legal: { entityType, taxSystem, vatMode },
    employees: { hasPayroll, headcount, payrollDates },
    operations: { bankAccounts, cashRegister, ofd, foreignOps },
    specialFlags: { tourismTax, excise, controlledTransactions },
    updatedAtIso
  };
}

function toggleInArray(xs: number[], value: number): number[] {
  const set = new Set(xs);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set).sort((a, b) => a - b);
}

export default function ClientProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const [profile, setProfile] = useState<ClientProfileV27>(() =>
    normalizeClientProfileV27(loadClientProfileV27(clientId), clientId)
  );

  const [savedAt, setSavedAt] = useState<string>(profile.updatedAtIso);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    const loaded = normalizeClientProfileV27(loadClientProfileV27(clientId), clientId);
    setProfile(loaded);
    setSavedAt(loaded.updatedAtIso);
    setToast("");
  }, [clientId]);

  const derived = useMemo(() => deriveReglementV27(profile), [profile]);
  const risk = useMemo(() => evaluateClientRiskV27(profile, derived), [profile, derived]);

  function update(mut: (p: ClientProfileV27) => ClientProfileV27) {
    setProfile((prev) => normalizeClientProfileV27(mut(prev), clientId));
  }

  function doSave() {
    setSaving(true);
    try {
      const next = { ...profile, updatedAtIso: new Date().toISOString() };
      saveClientProfileV27(next);
      setProfile(next);
      setSavedAt(next.updatedAtIso);
      setToast("Saved");
      window.setTimeout(() => setToast(""), 1200);
    } finally {
      setSaving(false);
    }
  }

  function doReset() {
    resetClientProfileV27(clientId);
    const fresh = normalizeClientProfileV27(loadClientProfileV27(clientId), clientId);
    setProfile(fresh);
    setSavedAt(fresh.updatedAtIso);
    setToast("Reset");
    window.setTimeout(() => setToast(""), 1200);
  }

  return (
    <PageShell>
      <UpBackBar
        title={`Client Profile: ${clientId || "-"}`}
        onUp={() => navigate("/")}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <RiskBadge score={risk.score} label={risk.label} />
            <button onClick={doReset} disabled={saving}>Reset</button>
            <button onClick={doSave} disabled={saving}>Save</button>
          </div>
        }
      />

      <div style={{ padding: 12, display: "grid", gap: 12 }}>
        <ClientTasksSummaryCard clientId={clientId} title="Tasks" />

        <div style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Legal</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Entity type</div>
            <select
              value={profile.legal.entityType}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, entityType: e.target.value as LegalEntityTypeV27 } }))}
            >
              <option value="IP">IP</option>
              <option value="OOO">OOO</option>
            </select>

            <div>Tax system</div>
            <select
              value={profile.legal.taxSystem}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, taxSystem: e.target.value as TaxSystemV27 } }))}
            >
              <option value="USN_DR">USN_DR</option>
              <option value="USN_DO">USN_DO</option>
              <option value="OSNO">OSNO</option>
            </select>

            <div>VAT mode</div>
            <select
              value={profile.legal.vatMode}
              onChange={(e) => update((p) => ({ ...p, legal: { ...p.legal, vatMode: e.target.value as VatModeV27 } }))}
            >
              <option value="NONE">NONE</option>
              <option value="VAT_5">VAT_5</option>
              <option value="VAT_20">VAT_20</option>
            </select>

            <div>Updated</div>
            <div style={{ opacity: 0.8 }}>{savedAt}</div>
          </div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Employees</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Has payroll</div>
            <input
              type="checkbox"
              checked={profile.employees.hasPayroll}
              onChange={(e) => update((p) => ({ ...p, employees: { ...p.employees, hasPayroll: e.target.checked } }))}
            />

            <div>Headcount</div>
            <input
              type="number"
              value={profile.employees.headcount}
              onChange={(e) => update((p) => ({ ...p, employees: { ...p.employees, headcount: clampInt(e.target.value, 0, 5000) } }))}
            />

            <div>Payroll dates</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                const on = profile.employees.payrollDates.includes(day);
                return (
                  <button
                    key={day}
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

        <div style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Operations</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Bank accounts</div>
            <input
              type="number"
              value={profile.operations.bankAccounts}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, bankAccounts: clampInt(e.target.value, 0, 50) } }))}
            />

            <div>Cash register</div>
            <input
              type="checkbox"
              checked={profile.operations.cashRegister}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, cashRegister: e.target.checked } }))}
            />

            <div>OFD</div>
            <input
              type="checkbox"
              checked={profile.operations.ofd}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, ofd: e.target.checked } }))}
            />

            <div>Foreign ops</div>
            <input
              type="checkbox"
              checked={profile.operations.foreignOps}
              onChange={(e) => update((p) => ({ ...p, operations: { ...p.operations, foreignOps: e.target.checked } }))}
            />
          </div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Special flags</h3>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
            <div>Tourism tax</div>
            <input
              type="checkbox"
              checked={profile.specialFlags.tourismTax}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, tourismTax: e.target.checked } }))}
            />

            <div>Excise</div>
            <input
              type="checkbox"
              checked={profile.specialFlags.excise}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, excise: e.target.checked } }))}
            />

            <div>Controlled transactions</div>
            <input
              type="checkbox"
              checked={profile.specialFlags.controlledTransactions}
              onChange={(e) => update((p) => ({ ...p, specialFlags: { ...p.specialFlags, controlledTransactions: e.target.checked } }))}
            />
          </div>
        </div>

        <div style={{ border: "1px solid #333", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Derived</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {derived.map((d) => (
              <span key={d.key} style={{ border: "1px solid #444", borderRadius: 999, padding: "3px 10px", opacity: 0.95 }}>
                {d.title}
              </span>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            <details>
              <summary style={{ cursor: "pointer" }}>Derived json</summary>
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