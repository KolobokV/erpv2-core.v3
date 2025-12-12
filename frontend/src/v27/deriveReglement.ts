import { ClientProfileV27, ReglementItemDerived } from "./types";

export const deriveReglementV27 = (p: ClientProfileV27): ReglementItemDerived[] => {
  const out: ReglementItemDerived[] = [];

  // TAX
  if (p.legal.taxSystem === "USN_DR" || p.legal.taxSystem === "USN_DO") {
    out.push({
      key: "tax.usn.advance",
      title: "USN advance payment",
      source: "TAX",
      reason: "legal.taxSystem=USN_*",
      periodicity: "QUARTERLY"
    });
    out.push({
      key: "tax.usn.declaration",
      title: "USN declaration",
      source: "TAX",
      reason: "legal.taxSystem=USN_*",
      periodicity: "YEARLY"
    });
  }

  if (p.legal.taxSystem === "OSNO") {
    out.push({
      key: "tax.osno.cit",
      title: "Corporate income tax",
      source: "TAX",
      reason: "legal.taxSystem=OSNO",
      periodicity: "QUARTERLY"
    });
  }

  if (p.legal.vatMode !== "NONE") {
    out.push({
      key: "tax.vat.reporting",
      title: "VAT reporting",
      source: "TAX",
      reason: "legal.vatMode!=NONE",
      periodicity: "QUARTERLY"
    });
  }

  // PAYROLL
  if (p.employees.hasPayroll) {
    out.push({
      key: "payroll.salary.run",
      title: "Payroll run",
      source: "PAYROLL",
      reason: "employees.hasPayroll=true",
      periodicity: "MONTHLY"
    });
    out.push({
      key: "payroll.reports",
      title: "Payroll reports",
      source: "PAYROLL",
      reason: "employees.hasPayroll=true",
      periodicity: "MONTHLY"
    });
  }

  // BANK
  out.push({
    key: "bank.statement.request",
    title: "Request bank statement",
    source: "BANK",
    reason: "operations.bankAccounts>=1",
    periodicity: "MONTHLY"
  });

  // SPECIAL
  if (p.specialFlags.tourismTax) {
    out.push({
      key: "special.tourism.tax",
      title: "Tourism tax",
      source: "SPECIAL",
      reason: "specialFlags.tourismTax=true",
      periodicity: "MONTHLY"
    });
  }

  return out;
};