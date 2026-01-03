import React from "react";
import "../../ui/taskSections.css";

type Props = {
  title: string;
  count: number;
};

export function TaskSectionHeader({ title, count }: Props) {
  return (
    <div className="task-section-header">
      <div className="task-section-title">{title}</div>
      <div className="task-section-count">{count}</div>
    </div>
  );
}

export default TaskSectionHeader;