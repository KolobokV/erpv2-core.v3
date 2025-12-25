export type IntakeData = {
  clientId: string;
  taxMode: "usn_dr" | "usn_income" | "vat";
  employees: number;
  payrollDay1: number;
  payrollDay2: number;
};

export type PreviewItem = { title: string; due: string };

export type DerivePreviewOut = {
  clientId: string;
  events: number;
  tasks: number;
  items: PreviewItem[];
};

export async function derivePreviewViaBackend(intake: IntakeData): Promise<DerivePreviewOut> {
  const resp = await fetch("/api/onboarding/derive-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: intake.clientId,
      tax_mode: intake.taxMode,
      employees: intake.employees,
      payroll_day1: intake.payrollDay1,
      payroll_day2: intake.payrollDay2
    })
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error("backend_not_ok:" + resp.status + ":" + txt);
  }

  const data = await resp.json();
  return {
    clientId: data.client_id,
    events: data.events,
    tasks: data.tasks,
    items: data.items || []
  };
}