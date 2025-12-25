import { useMemo, useState } from "react";

export type IntakeData = {
  clientId: string;
  taxMode: "usn_dr" | "usn_income" | "vat";
  employees: number;
  payrollDay1: number;
  payrollDay2: number;
};

type Props = {
  onSubmit: (data: IntakeData) => void;
};

function clampInt(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function normalizeClientId(raw: string): string {
  // keep ascii letters, digits, underscore, dash
  const s = raw.trim().toLowerCase();
  return s.replace(/[^a-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

export default function ClientIntakeForm({ onSubmit }: Props) {
  const [clientId, setClientId] = useState("demo_client");
  const [taxMode, setTaxMode] = useState<IntakeData["taxMode"]>("usn_dr");
  const [employees, setEmployees] = useState(0);
  const [payrollDay1, setPayrollDay1] = useState(10);
  const [payrollDay2, setPayrollDay2] = useState(25);

  const normalized = useMemo(() => normalizeClientId(clientId), [clientId]);

  const canSubmit = useMemo(() => {
    return normalized.length >= 3 && normalized.length <= 40;
  }, [normalized]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      clientId: normalized,
      taxMode,
      employees: clampInt(employees, 0, 500),
      payrollDay1: clampInt(payrollDay1, 1, 31),
      payrollDay2: clampInt(payrollDay2, 1, 31)
    });
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Client intake</h3>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Client ID (slug)</div>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="e.g. ip_usn_dr"
            style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Normalized: <code>{normalized || "(empty)"}</code>
          </div>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Tax mode</div>
          <select
            value={taxMode}
            onChange={(e) => setTaxMode(e.target.value as IntakeData["taxMode"])}
            style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }}
          >
            <option value="usn_dr">USN (income-expense)</option>
            <option value="usn_income">USN (income)</option>
            <option value="vat">VAT</option>
          </select>
        </label>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Employees</div>
            <input
              type="number"
              value={employees}
              onChange={(e) => setEmployees(parseInt(e.target.value || "0", 10))}
              style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Payroll day #1</div>
            <input
              type="number"
              value={payrollDay1}
              onChange={(e) => setPayrollDay1(parseInt(e.target.value || "1", 10))}
              style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Payroll day #2</div>
            <input
              type="number"
              value={payrollDay2}
              onChange={(e) => setPayrollDay2(parseInt(e.target.value || "1", 10))}
              style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8 }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{ padding: "8px 12px", opacity: canSubmit ? 1 : 0.5 }}
          >
            Generate preview
          </button>
          {!canSubmit ? (
            <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
              Client ID must be 3..40 chars after normalization.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}