import { useEffect, useMemo, useState } from "react";
import { apiGetJson, apiPostJson, apiPutJson } from "../api";
import { TaskCard } from "../components/tasks/TaskCard";

type Task = {
  id: string;
  client_code?: string;
  client_label?: string;
  title: string;
  status: string;
  priority?: string;
  deadline?: string;
};

type ClientProfile = {
  id: string;
  name: string;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientFilter, setClientFilter] = useState<string>("");

  useEffect(() => {
    apiGetJson("/api/internal/tasks").then(setTasks);
    apiGetJson("/api/internal/client-profiles").then(r => {
      setClients(r.items ?? []);
    });
  }, []);

  const visibleTasks = useMemo(() => {
    if (!clientFilter) return tasks;
    return tasks.filter(t => t.client_code === clientFilter);
  }, [tasks, clientFilter]);

  async function setStatus(taskId: string, status: string) {
    await apiPutJson(`/api/internal/tasks/${taskId}/status`, { status });
    setTasks(t =>
      t.map(x => (x.id === taskId ? { ...x, status } : x))
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Tasks</h2>

      <select
        value={clientFilter}
        onChange={e => setClientFilter(e.target.value)}
      >
        <option value="">All clients</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 16 }}>
        {visibleTasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onSetStatus={setStatus}
          />
        ))}
      </div>
    </div>
  );
}