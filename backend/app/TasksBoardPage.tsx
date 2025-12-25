import React, { useEffect, useState, useMemo } from "react";
import SectionCard from "../components/ui/SectionCard";
import TaskCard from "../components/ui/TaskCard";

const TasksBoardPage = () => {
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
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({status})
    });
    loadTasks();
  };

  const deferTask = async (task, days) => {
    const base = task.deadline || new Date().toISOString();
    const next = addDays(base, days);

    await fetch(`/api/tasks/${task.id}`, {
      method:"PATCH",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({deadline:next})
    });

    loadTasks();
  };

  const buckets = useMemo(() => {
    const b = { overdue:[], today:[], next7:[], future:[] };

    tasks.forEach(t=>{
      if(!t.deadline){ b.future.push(t); return; }
      const d = new Date(t.deadline);
      const diff = Math.floor((d - today)/86400000);
      if(diff<0) b.overdue.push(t);
      else if(diff===0) b.today.push(t);
      else if(diff<=7) b.next7.push(t);
      else b.future.push(t);
    });

    return b;
  },[tasks]);

  const block = (title,list) => (
    <SectionCard title={title}>
      {list.length===0 ?
        <div className="text-xs text-slate-500">No tasks</div> :
        <div className="space-y-2">
          {list.map(t=>(
            <TaskCard
              key={t.id}
              task={t}
              onStart={()=>changeStatus(t,"in_progress")}
              onComplete={()=>changeStatus(t,"completed")}
              onReopen={()=>changeStatus(t,"new")}
              onDefer={(task,days)=>deferTask(task,days)}
            />
          ))}
        </div>
      }
    </SectionCard>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Tasks Board V3</h1>
      {block("Overdue", buckets.overdue)}
      {block("Today", buckets.today)}
      {block("Next 7 days", buckets.next7)}
      {block("Future", buckets.future)}
    </div>
  );
};

export default TasksBoardPage;