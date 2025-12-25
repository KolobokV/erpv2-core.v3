import { ClientProfileV27, ReglementItemDerived, RiskItem } from "./types";

export type RiskEvaluationV27 = {
  score: number;
  label: string;
  risks: RiskItem[];
};

export const computeRisksV27 = (p: ClientProfileV27, derived: ReglementItemDerived[]): RiskItem[] => {
  const risks: RiskItem[] = [];

  const hasPayroll = Boolean((p as any)?.employees?.hasPayroll);
  const headcount = Number((p as any)?.employees?.headcount || 0);
  const taxSystem = String((p as any)?.legal?.taxSystem || "");
  const vatMode = String((p as any)?.legal?.vatMode || "NONE");

  if (hasPayroll && headcount <= 0) {
    risks.push({
      kind: "INCONSISTENT",
      key: "risk.inconsistent.payroll.headcount",
      title: "Payroll enabled but headcount is zero",
      details: "employees.hasPayroll=true and employees.headcount<=0",
      severity: 3
    } as any);
  }

  if (taxSystem === "USN_DO" && vatMode !== "NONE") {
    risks.push({
      kind: "INCONSISTENT",
      key: "risk.inconsistent.vat.usn",
      title: "VAT enabled with USN_DO",
      details: "Check if VAT mode is correct for this client",
      severity: 2
    } as any);
  }

  if (!Array.isArray(derived) || derived.length === 0) {
    risks.push({
      kind: "MISSING",
      key: "risk.missing.reglement",
      title: "No reglement items derived",
      details: "Derived reglement list is empty",
      severity: 4
    } as any);
  }

  return risks;
};

const clampScore = (n: number): number => {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(n)));
};

const labelFromScore = (score: number): string => {
  if (score >= 80) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
};

export const evaluateClientRiskV27 = (p: ClientProfileV27, derived: ReglementItemDerived[]): RiskEvaluationV27 => {
  const risks = computeRisksV27(p, derived);

  // Simple scoring: max severity drives base, plus small additive factor
  const severities = risks.map((r: any) => Number(r?.severity || 0)).filter((x) => Number.isFinite(x));
  const maxSev = severities.length ? Math.max(...severities) : 0;
  const sumSev = severities.reduce((a, b) => a + b, 0);

  const base = maxSev * 20;      // 0..100
  const extra = sumSev * 2;      // small bump
  const score = clampScore(base + extra);

  return {
    score,
    label: labelFromScore(score),
    risks
  };
};