import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ClientProfileV27 } from "../v27/types";
import { deriveReglementV27 } from "../v27/deriveReglement";
import { computeRisksV27 } from "../v27/riskEngine";
import { RiskBadge, RiskList } from "../components/RiskBadge";
import {
  getClientProfileKeyV27,
  loadClientProfileV27,
  resetClientProfileV27,
  saveClientProfileV27,
  tryReadRawClientProfileV27
} from "../v27/profileStore";

function useQueryParam(name: string): string | null {
  const loc = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(loc.search);
    const v = sp.get(name);
    return v && v.trim().length > 0 ? v : null;
  }, [loc.search, name]);
}

function clampInt(v: any, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

type SaveDiag = {
  status: "idle" | "ok" | "err";
  message: string;
  key: string;
  size: number;
  atIso: string;
};

export default function ClientProfilePage() {
  const clientId = useQueryParam("client") || "all";

  const [profile, setProfile] = useState<ClientProfileV27>(() => loadClientProfileV27(clientId));
  const [savedAt, setSavedAt] = useState<string>(profile.updatedAtIso);

  const [diag, setDiag] = useState<SaveDiag>(() => ({
    status: "idle",
    message: "No actions yet",
    key: getClientProfileKeyV27(clientId),
    size: 0,
    atIso: new Date().toISOString()
  }));

  useEffect(() => {
    const loaded = loadClientProfileV27(clientId);
    setProfile(loaded);
    setSavedAt(loaded.updatedAtIso);

    setDiag({
      status: "idle",
      message: "Loaded",
      key: getClientProfileKeyV27(clientId),
      size: 0,
      atIso: new Date().toISOString()
    });
  }, [clientId]);

  const derived = useMemo(() => deriveReglementV27(profile), [profile]);
  const risks = useMemo(() => computeRisksV27(profile, derived), [profile, derived]);

  function update(next: ClientProfileV27) {
    setProfile(next);
  }

  function doSave() {
    const res = saveClientProfileV27(profile);
    if (res.ok) {
      setSavedAt(new Date().toISOString());
      setDiag({
        status: "ok",
        message: "Saved to localStorage",
        key: res.key,
        size: res.size,
        atIso: new Date().toISOString()
      });
    } else {
      setDiag({
        status: "err",
        message: res.error || "Save failed",
        key: res.key,
        size: res.size,
        atIso: new Date().toISOString()
      });
    }
  }

  function doReset() {
    const rr = resetClientProfileV27(clientId);
    setProfile(rr.profile);
    setSavedAt(rr.profile.updatedAtIso);

    setDiag({
      status: rr.result.ok ? "ok" : "err",
      message: rr.result.ok ? "Reset + saved" : (rr.result.error || "Reset save failed"),
      key: rr.result.key,
      size: rr.result.size,
      atIso: new Date().toISOString()
    });
  }

  const storageProbe = useMemo(() => {
    const res = tryReadRawClientProfileV27(clientId);
    const key = getClientProfileKeyV27(clientId);
    return {
      ok: res.ok,
      key,
      exists: res.ok && !!res.raw,
      rawLen: res.raw ? res.raw.length : 0,
      error: res.error || ""
    };
  }, [clientId, savedAt, diag.atIso]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold flex items-center">
            Client Profile
            <RiskBadge count={risks.length} />
          </div>
          <div className="text-sm text-muted-foreground">
            Client: <span className="font-mono">{clientId}</span> · Updated: <span className="font-mono">{savedAt}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-md border px-3 py-2 text-sm" onClick={doReset}>
            Reset
          </button>
          <button className="rounded-md border px-3 py-2 text-sm" onClick={doSave}>
            Save
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Storage diagnostics</div>
          <div className="text-xs text-muted-foreground font-mono">{diag.atIso}</div>
        </div>

        <div className="mt-2 grid grid-cols-1 xl:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">lastAction</div>
            <div className="font-mono">{diag.status}</div>
            <div className="font-mono break-all">{diag.message}</div>
          </div>

          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">key</div>
            <div className="font-mono break-all">{diag.key}</div>
            <div className="text-muted-foreground">size</div>
            <div className="font-mono">{diag.size}</div>
          </div>

          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">probeOk</div>
            <div className="font-mono">{String(storageProbe.ok)}</div>
            <div className="text-muted-foreground">exists</div>
            <div className="font-mono">{String(storageProbe.exists)}</div>
          </div>

          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground">rawLen</div>
            <div className="font-mono">{storageProbe.rawLen}</div>
            <div className="text-muted-foreground">error</div>
            <div className="font-mono break-all">{storageProbe.error || "-"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-xl border p-4 space-y-4">
          <div className="font-medium">Legal</div>

          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <div className="text-xs text-muted-foreground">Entity type</div>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={profile.legal.entityType}
                onChange={(e) => update({ ...profile, legal: { ...profile.legal, entityType: e.target.value as any } })}
              >
                <option value="IP">IP</option>
                <option value="OOO">OOO</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs text-muted-foreground">Tax system</div>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={profile.legal.taxSystem}
                onChange={(e) => update({ ...profile, legal: { ...profile.legal, taxSystem: e.target.value as any } })}
              >
                <option value="USN_DR">USN_DR</option>
                <option value="USN_DO">USN_DO</option>
                <option value="OSNO">OSNO</option>
              </select>
            </label>

            <label className="space-y-1">
              <div className="text-xs text-muted-foreground">VAT mode</div>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={profile.legal.vatMode}
                onChange={(e) => update({ ...profile, legal: { ...profile.legal, vatMode: e.target.value as any } })}
              >
                <option value="NONE">NONE</option>
                <option value="VAT_5">VAT_5</option>
                <option value="VAT_20">VAT_20</option>
              </select>
            </label>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="font-medium">Employees</div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={profile.employees.hasPayroll}
                onChange={(e) => update({ ...profile, employees: { ...profile.employees, hasPayroll: e.target.checked } })}
              />
              Payroll enabled
            </label>

            <label className="space-y-1">
              <div className="text-xs text-muted-foreground">Headcount</div>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={profile.employees.headcount}
                onChange={(e) => update({ ...profile, employees: { ...profile.employees, headcount: clampInt(e.target.value, 0, 5000) } })}
              />
            </label>

            <label className="space-y-1">
              <div className="text-xs text-muted-foreground">Payroll dates (comma-separated)</div>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={profile.employees.payrollDates.join(",")}
                onChange={(e) => {
                  const parts = e.target.value
                    .split(",")
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(s => clampInt(s, 1, 31));
                  update({ ...profile, employees: { ...profile.employees, payrollDates: parts } });
                }}
              />
            </label>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="font-medium">Operations</div>

            <label className="space-y-1">
              <div className="text-xs text-muted-foreground">Bank accounts</div>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={profile.operations.bankAccounts}
                onChange={(e) => update({ ...profile, operations: { ...profile.operations, bankAccounts: clampInt(e.target.value, 0, 100) } })}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.operations.cashRegister}
                  onChange={(e) => update({ ...profile, operations: { ...profile.operations, cashRegister: e.target.checked } })}
                />
                Cash register
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.operations.ofd}
                  onChange={(e) => update({ ...profile, operations: { ...profile.operations, ofd: e.target.checked } })}
                />
                OFD
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.operations.foreignOps}
                  onChange={(e) => update({ ...profile, operations: { ...profile.operations, foreignOps: e.target.checked } })}
                />
                Foreign ops
              </label>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="font-medium">Special flags</div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.specialFlags.tourismTax}
                  onChange={(e) => update({ ...profile, specialFlags: { ...profile.specialFlags, tourismTax: e.target.checked } })}
                />
                Tourism tax
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.specialFlags.excise}
                  onChange={(e) => update({ ...profile, specialFlags: { ...profile.specialFlags, excise: e.target.checked } })}
                />
                Excise
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={profile.specialFlags.controlledTransactions}
                  onChange={(e) => update({ ...profile, specialFlags: { ...profile.specialFlags, controlledTransactions: e.target.checked } })}
                />
                Controlled tx
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Derived reglement</div>
            <div className="text-xs text-muted-foreground">{derived.length} items</div>
          </div>

          {derived.length === 0 ? (
            <div className="text-sm text-muted-foreground">No derived items</div>
          ) : (
            <div className="space-y-2">
              {derived.map(it => (
                <div key={it.key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-muted-foreground">{it.source} · {it.periodicity}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    reason: <span className="font-mono">{it.reason}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    key: <span className="font-mono">{it.key}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Risk engine</div>
            <div className="text-xs text-muted-foreground">{risks.length} risks</div>
          </div>

          <RiskList risks={risks} />

          <div className="border-t pt-3 text-xs text-muted-foreground">
            Note: In v27.B we will compare derived items with backend data to detect missing and overdue.
          </div>
        </div>
      </div>
    </div>
  );
}