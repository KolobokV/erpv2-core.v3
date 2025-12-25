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

  payroll: {
    enabled: boolean;
    payDays: number[];
    hasVacationPay: boolean;
    hasSickPay: boolean;
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
  source: "TAX" | "PAYROLL" | "SPECIAL" | "OTHER";
  reason: string;
  periodicity: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ADHOC";
};

export type RiskItem = {
  code: string;
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
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
    payroll: {
      enabled: false,
      payDays: [],
      hasVacationPay: false,
      hasSickPay: false
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