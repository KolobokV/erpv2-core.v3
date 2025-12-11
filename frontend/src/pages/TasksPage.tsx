import React, { useEffect, useState, useMemo } from "react";
import SectionCard from "../components/ui/SectionCard";
import TaskCard from "../components/ui/TaskCard";

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState([]);

  const loadTasks = async () => {
    const resp = await fetch("/api/tasks");
    const json = await resp.json();
    const arr = Array.isArray(json) ? json : json.tasks || [];
    setTasks(arr);
  };

  useEffect(() => { loadTasks(); }, []);

  const today = new Date();

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const changeStatus = async (task, status) => {
    await fetch(`/api/tasks/${task.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadTasks();
  };

  const deferTask = async (task, days) => {
    const base = task.deadline || new Date().toISOString();
    const newDL = addDays(base, days);

    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deadline: newDL }),
    });

    loadTasks();
  };

  const buckets = useMemo(() => {
    const map = { overdue: [], today: [], next7: [], future: [] };

    tasks.forEach((t) => {
      if (!t.deadline) {
        map.future.push(t);
        return;
      }
      const d = new Date(t.deadline);
      const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
      if (diff < 0) map.overdue.push(t);
      else if (diff === 0) map.today.push(t);
      else if (diff <= 7) map.next7.push(t);
      else map.future.push(t);
    });

    return map;
  }, [tasks]);

  const renderBucket = (title, list) => (
    <SectionCard title={title}>
      {list.length === 0 ? (
        <div className="text-xs text-slate-500">No tasks</div>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onStart={() => changeStatus(t, "in_progress")}
              onComplete={() => changeStatus(t, "completed")}
              onReopen={() => changeStatus(t, "new")}
              onDefer={(task, days) => deferTask(task, days)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Tasks Board V3</h1>
      {renderBucket("Overdue", buckets.overdue)}
      {renderBucket("Today", buckets.today)}
      {renderBucket("Next 7 days", buckets.next7)}
      {renderBucket("Future", buckets.future)}
    </div>
  );
};

export default TasksPage;