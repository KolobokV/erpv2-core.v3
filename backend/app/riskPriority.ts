export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Priority = "p4" | "p3" | "p2" | "p1";

export type RiskResult = {
  daysToDeadline: number | null;
  riskLevel: RiskLevel;
  priority: Priority;
};

export function deriveRisk(deadline?: string | null): RiskResult {
  if (!deadline) {
    return {
      daysToDeadline: null,
      riskLevel: "medium",
      priority: "p3",
    };
  }

  const now = new Date();
  const d = new Date(deadline);
  const diffMs = d.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { daysToDeadline: days, riskLevel: "critical", priority: "p1" };
  }

  if (days <= 1) {
    return { daysToDeadline: days, riskLevel: "high", priority: "p2" };
  }

  if (days <= 3) {
    return { daysToDeadline: days, riskLevel: "medium", priority: "p3" };
  }

  return { daysToDeadline: days, riskLevel: "low", priority: "p4" };
}