export type TaskLike = {
  id: string;
  deadline?: string | null;
};

export type TaskSectionKey = "overdue" | "today" | "upcoming";

export function groupTasksByDeadline<T extends TaskLike>(
  tasks: T[]
): Record<TaskSectionKey, T[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const result: Record<TaskSectionKey, T[]> = {
    overdue: [],
    today: [],
    upcoming: [],
  };

  for (const t of tasks) {
    if (!t.deadline) {
      result.upcoming.push(t);
      continue;
    }

    const d = new Date(t.deadline);
    if (Number.isNaN(d.getTime())) {
      result.upcoming.push(t);
      continue;
    }

    if (d < todayStart) result.overdue.push(t);
    else if (d >= todayStart && d < todayEnd) result.today.push(t);
    else result.upcoming.push(t);
  }

  return result;
}