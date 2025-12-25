import React from "react";
import TasksBoard from "../components/tasks/TasksBoard";

const TasksDashboard: React.FC = () => {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Tasks dashboard
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Operational tasks loaded from backend.
          </p>
        </div>
      </header>

      <TasksBoard />
    </div>
  );
};

export default TasksDashboard;
