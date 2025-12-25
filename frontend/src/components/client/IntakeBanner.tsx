import { loadIntake } from "../lib/intakeStore";

export function IntakeBanner({ clientId }: { clientId: string }) {
  const v = loadIntake(clientId);
  if (!v) return null;
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <strong>Intake</strong>: {v.taxMode}, employees {v.employees}, payroll {v.payrollDay1}/{v.payrollDay2}
    </div>
  );
}