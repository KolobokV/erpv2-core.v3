import { useEffect, useMemo, useState } from "react";
import { apiGetJson, apiPutJson } from "../api";
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

const S_TITLE = "\u0417\u0430\u0434\u0430\u0447\u0438";
const S_CLIENT = "\u041a\u043b\u0438\u0435\u043d\u0442";
const S_ALL_CLIENTS = "\u0412\u0441\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u044b";
const S_NO_TASKS = "\u0417\u0430\u0434\u0430\u0447 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.";
const S_HINT =
  "\u0415\u0441\u043b\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u043d\u0435 \u043f\u043e\u044f\u0432\u043b\u044f\u044e\u0442\u0441\u044f, \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 " +
  "\u0421\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0438 (\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e).";

function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientFilter, setClientFilter] = useState<string>("");

  useEffect(() => {
    apiGetJson("/api/internal/tasks").then((r: any) => setTasks(asArray<Task>(r)));
    apiGetJson("/api/internal/client-profiles").then((r: any) => {
      const items =
        r && typeof r === "object" && Array.isArray((r as any).items) ? (r as any).items : [];
      setClients(asArray<ClientProfile>(items));
    });
  }, []);

  const visibleTasks = useMemo(() => {
    if (!clientFilter) return tasks;
    return tasks.filter((t) => t.client_code === clientFilter);
  }, [tasks, clientFilter]);

  async function setStatus(taskId: string, status: string) {
    await apiPutJson(`/api/internal/tasks/${taskId}/status`, { status });
    setTasks((t) => t.map((x) => (x.id === taskId ? { ...x, status } : x)));
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{S_TITLE}</h2>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>{S_CLIENT}</label>

        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="">{S_ALL_CLIENTS}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 16 }}>
        {visibleTasks.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            <div style={{ fontWeight: 800 }}>{S_NO_TASKS}</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{S_HINT}</div>
          </div>
        ) : null}

        {visibleTasks.map((t) => (
          <TaskCard key={t.id} task={t} onSetStatus={setStatus} />
        ))}
      </div>
    </div>
  );
}