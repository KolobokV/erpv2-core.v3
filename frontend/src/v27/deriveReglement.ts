import { ClientProfileV27, ReglementItemDerived } from "./types";

export const deriveReglementV27 = (p: ClientProfileV27): ReglementItemDerived[] => {
  const out: ReglementItemDerived[] = [];

  const taxSystem = String((p as any)?.legal?.taxSystem || "");
  const vatMode = String((p as any)?.legal?.vatMode || "NONE");
  const hasPayroll = Boolean((p as any)?.employees?.hasPayroll);
  const tourismTax = Boolean((p as any)?.specialFlags?.tourismTax);

  // TAX
  if (taxSystem === "USN_DR" || taxSystem === "USN_DO") {
    out.push({
      key: "tax.usn.advance",
      title: "USN advance payment",
      source: "TAX",
      reason: "legal.taxSystem=USN_*",
      periodicity: "QUARTERLY"
    });
    out.push({
      key: "tax.usn.year",
      title: "USN annual declaration",
      source: "TAX",
      reason: "legal.taxSystem=USN_*",
      periodicity: "YEARLY"
    });
  } else {
    out.push({
      key: "tax.osno.profit",
      title: "Profit tax reporting",
      source: "TAX",
      reason: "legal.taxSystem=OSNO",
      periodicity: "QUARTERLY"
    });
  }

  if (vatMode !== "NONE") {
    out.push({
      key: "tax.vat.reporting",
      title: "VAT reporting",
      source: "TAX",
      reason: "legal.vatMode!=NONE",
      periodicity: "QUARTERLY"
    });
  }

  // PAYROLL
  if (hasPayroll) {
    out.push({
      key: "payroll.salary",
      title: "Payroll processing",
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
  if (tourismTax) {
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