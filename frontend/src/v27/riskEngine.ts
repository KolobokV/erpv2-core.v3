import { ClientProfileV27, ReglementItemDerived, RiskItem } from "./types";

export const computeRisksV27 = (p: ClientProfileV27, derived: ReglementItemDerived[]): RiskItem[] => {
  const risks: RiskItem[] = [];

  // INCONSISTENT examples (pure profile sanity)
  if (p.employees.hasPayroll && p.employees.headcount <= 0) {
    risks.push({
      kind: "INCONSISTENT",
      key: "risk.inconsistent.payroll.headcount",
      title: "Payroll enabled but headcount is zero",
      details: "employees.hasPayroll=true and employees.headcount<=0",
      severity: 3
    });
  }

  if (p.legal.vatMode !== "NONE" && p.legal.taxSystem === "USN_DO") {
    risks.push({
      kind: "INCONSISTENT",
      key: "risk.inconsistent.vat.usn",
      title: "VAT enabled with USN_DO",
      details: "Check if VAT mode is correct for this client",
      severity: 2
    });
  }

  // MISSING placeholder: in v27.B we will compare derived vs actual backend data (tasks/processes)
  // For now we only ensure derived is not empty
  if (derived.length === 0) {
    risks.push({
      kind: "MISSING",
      key: "risk.missing.reglement",
      title: "No reglement items derived",
      details: "Derived reglement list is empty. Profile may be incomplete.",
      severity: 4
    });
  }

  return risks;
};