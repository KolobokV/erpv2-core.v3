export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type DeadlineStatus =
  | "ok"
  | "today"
  | "overdue";

export function getDeadlineStatus(deadlineIso: string | null): DeadlineStatus {
  if (!deadlineIso) return "ok";

  const now = new Date();
  const deadline = new Date(deadlineIso);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (deadline < todayStart) return "overdue";
  if (deadline >= todayStart && deadline < todayEnd) return "today";
  return "ok";
}

export function getPriorityClass(priority: TaskPriority | null): string {
  switch (priority) {
    case "urgent":
      return "task-priority-urgent";
    case "high":
      return "task-priority-high";
    case "medium":
      return "task-priority-medium";
    case "low":
      return "task-priority-low";
    default:
      return "task-priority-medium";
  }
}

export function getDeadlineClass(status: DeadlineStatus): string {
  switch (status) {
    case "overdue":
      return "task-deadline-overdue";
    case "today":
      return "task-deadline-today";
    default:
      return "task-deadline-ok";
  }
}