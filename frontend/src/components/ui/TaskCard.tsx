import React from "react";

const TaskCard = ({ task, onStart, onComplete, onReopen, onDefer }) => {
  const status = (task.status || "new").toLowerCase();

  return (
    <div className="border p-2 rounded-md bg-white text-xs shadow-sm">
      <div className="flex justify-between">
        <div className="font-semibold text-slate-900">{task.title}</div>
        <div className="text-slate-500">{task.client_label || task.client_code}</div>
      </div>

      {task.description && (
        <div className="mt-1 text-slate-600">{task.description}</div>
      )}

      <div className="mt-2 flex gap-1">
        {status === "new" && (
          <button className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md"
            onClick={() => onStart(task)}>
            Start
          </button>
        )}

        {status !== "completed" && (
          <button className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md"
            onClick={() => onComplete(task)}>
            Complete
          </button>
        )}

        {status === "completed" && (
          <button className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md"
            onClick={() => onReopen(task)}>
            Reopen
          </button>
        )}

        <button onClick={() => onDefer(task,1)} className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-md">+1d</button>
        <button onClick={() => onDefer(task,3)} className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-md">+3d</button>
        <button onClick={() => onDefer(task,7)} className="px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-md">+7d</button>
      </div>
    </div>
  );
};

export default TaskCard;