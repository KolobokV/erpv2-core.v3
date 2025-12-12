export type TaxSystem = "USN_DR" | "USN_DO" | "OSNO";
export type VatMode = "NONE" | "VAT_5" | "VAT_20";
export type EntityType = "IP" | "OOO";
export type RiskTolerance = "LOW" | "MEDIUM" | "HIGH";
export type ServiceLevel = "BASIC" | "STANDARD" | "PREMIUM";

export type ClientProfileV27 = {
  clientId: string;

  legal: {
    entityType: EntityType;
    taxSystem: TaxSystem;
    vatMode: VatMode;
  };

  employees: {
    hasPayroll: boolean;
    headcount: number;
    payrollDates: number[];
  };

  operations: {
    bankAccounts: number;
    cashRegister: boolean;
    ofd: boolean;
    foreignOps: boolean;
  };

  specialFlags: {
    tourismTax: boolean;
    excise: boolean;
    controlledTransactions: boolean;
  };

  calendar: {
    reportingMode: "MONTHLY" | "QUARTERLY";
  };

  meta: {
    riskTolerance: RiskTolerance;
    serviceLevel: ServiceLevel;
  };

  updatedAtIso: string;
};

export type ReglementItemDerived = {
  key: string;
  title: string;
  source: "TAX" | "PAYROLL" | "BANK" | "SPECIAL";
  reason: string;
  periodicity: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ON_DEMAND";
};

export type RiskKind = "MISSING" | "OVERDUE" | "INCONSISTENT" | "OVERLOAD";

export type RiskItem = {
  kind: RiskKind;
  key: string;
  title: string;
  details: string;
  severity: 1 | 2 | 3 | 4 | 5;
};

export const makeDefaultClientProfileV27 = (clientId: string): ClientProfileV27 => {
  const now = new Date().toISOString();
  return {
    clientId,
    legal: {
      entityType: "OOO",
      taxSystem: "USN_DR",
      vatMode: "NONE"
    },
    employees: {
      hasPayroll: false,
      headcount: 0,
      payrollDates: []
    },
    operations: {
      bankAccounts: 1,
      cashRegister: false,
      ofd: false,
      foreignOps: false
    },
    specialFlags: {
      tourismTax: false,
      excise: false,
      controlledTransactions: false
    },
    calendar: {
      reportingMode: "MONTHLY"
    },
    meta: {
      riskTolerance: "MEDIUM",
      serviceLevel: "STANDARD"
    },
    updatedAtIso: now
  };
};