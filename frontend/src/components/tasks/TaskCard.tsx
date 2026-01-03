import React from "react";

export function TaskCard({ task }: any) {
  const clientLabel =
    task.client_name
      ? task.client_name
      : task.client_count
        ? `${task.client_count} clients`
        : "Client";

  const sourceLabel = task.is_auto_generated
    ? "Created automatically"
    : null;

  return (
    <div className="task-card">
      <div className="task-title">{task.title}</div>

      <div className="task-sub">
        {clientLabel}
        {sourceLabel && <span> · {sourceLabel}</span>}
      </div>

      <div className="task-deadline">
        Deadline: {task.deadline_human}
      </div>
    </div>
  );
}