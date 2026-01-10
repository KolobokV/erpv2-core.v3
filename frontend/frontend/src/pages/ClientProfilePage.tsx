import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGetJson } from "../api";
import { TaskCard } from "../components/tasks/TaskCard";

type Client = {
  id: string;
  code?: string;
  name?: string;
  label?: string;
  inn?: string;
  tax_system?: string;
  taxSystem?: string;
  responsible_name?: string;
  responsibleName?: string;
  status?: string;
  [k: string]: any;
};

type Task = {
  id: string;
  client_code?: string;
  client_label?: string;
  title: string;
  status: string;
  priority?: string;
  deadline?: any;
  description?: string;
  [k: string]: any;
};

type ClientProfileStore = Record<string, Client>;

const LS_CLIENT_PROFILES = "erpv2_client_profiles_v1";

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function loadProfiles(): ClientProfileStore {
  try {
    const raw = localStorage.getItem(LS_CLIENT_PROFILES);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as ClientProfileStore;
  } catch {
    // ignore
  }
  return {};
}

function pickClientName(c?: Client | null): string {
  if (!c) return "";
  return s(c.name || c.label || c.code || c.id);
}

function pickTaxSystem(c?: Client | null): string {
  if (!c) return "";
  return s(c.tax_system || c.taxSystem || "");
}

function pickResponsible(c?: Client | null): string {
  if (!c) return "";
  return s(c.responsible_name || c.responsibleName || "");
}

function pickInn(c?: Client | null): string {
  if (!c) return "";
  return s(c.inn || "");
}

function pickStatus(c?: Client | null): string {
  if (!c) return "";
  return s(c.status || "");
}

function fmtDateIsoLike(v?: string): string {
  if (!v) return "";
  const t = v.replace("T", " ").replace("Z", "");
  return t.length > 16 ? t.slice(0, 16) : t;
}

function badgeClass(kind: "ok" | "warn" | "bad" | "muted") {
  switch (kind) {
    case "ok":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "warn":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "bad":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-slate-200";
  }
}

function statusToBadgeKind(status?: string): "ok" | "warn" | "bad" | "muted" {
  const s0 = (status || "").toLowerCase();
  if (["completed", "done", "ok"].includes(s0)) return "ok";
  if (["overdue", "late", "expired"].includes(s0)) return "bad";
  if (["in_progress", "inprogress", "working"].includes(s0)) return "warn";
  return "muted";
}

function normalizeDateToMs(v: any): number {
  if (!v) return NaN;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? NaN : ms;
  }
  if (typeof v === "object") {
    const iso = s((v as any).iso || (v as any).date || (v as any).value || "");
    if (iso) {
      const ms = Date.parse(iso);
      return Number.isNaN(ms) ? NaN : ms;
    }
  }
  return NaN;
}

function TaskMiniList(props: { title: string; tasks: Task[]; emptyText: string }) {
  const { title, tasks, emptyText } = props;
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{tasks.length}</div>
      </div>
      <div className="p-3 space-y-3">
        {tasks.length === 0 ? (
          <div className="text-sm text-slate-500">{emptyText}</div>
        ) : (
          tasks.slice(0, 6).map((t) => <TaskCard key={t.id} task={t as any} />)
        )}
      </div>
    </div>
  );
}

type ClientListItem = {
  id: string;
  label: string;
  last_deadline?: string;
  tasks_open?: number;
};

export default function ClientProfilePage() {
  const params = useParams();
  const navigate = useNavigate();
  const clientId = (params as any)?.id as string | undefined;

  const [profiles, setProfiles] = useState<ClientProfileStore>(() => loadProfiles());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isListMode = !clientId;

  useEffect(() => {
    setProfiles(loadProfiles());
  }, [clientId]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiGetJson("/api/internal/tasks");
        const arr = (data?.tasks ?? data) as any;
        const list: Task[] = Array.isArray(arr) ? arr : arr ? [arr] : [];
        if (!alive) return;
        setTasks(list);
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e || "error"));
        setTasks([]);
      } finally {
        if (alive) setIsLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const listItems = useMemo(() => {
    const map: Record<string, ClientListItem> = {};
    for (const t of tasks) {
      const code = s(t.client_code || "");
      if (!code) continue;
      if (!map[code]) {
        const p = profiles[code];
        map[code] = {
          id: code,
          label: p ? pickClientName(p) : s(t.client_label || code),
          last_deadline: "",
          tasks_open: 0,
        };
      }
      const st = s(t.status || "").toLowerCase();
      if (st !== "done" && st !== "completed") {
        map[code].tasks_open = (map[code].tasks_open || 0) + 1;
      }
      const ms = normalizeDateToMs(t.deadline);
      if (!Number.isNaN(ms)) {
        const iso = new Date(ms).toISOString();
        const cur = map[code].last_deadline || "";
        if (!cur || Date.parse(cur) < ms) map[code].last_deadline = iso;
      }
    }
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks, profiles]);

  const client: Client | null = useMemo(() => {
    if (!clientId) return null;
    const p = profiles[clientId];
    if (p) return { ...p, id: clientId };
    return { id: clientId, code: clientId, name: clientId, label: clientId };
  }, [clientId, profiles]);

  const clientTasks = useMemo(() => {
    if (!clientId) return [];
    return tasks.filter((t) => s(t.client_code || "") === clientId);
  }, [tasks, clientId]);

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return clientTasks.filter((t) => {
      const dl = normalizeDateToMs(t.deadline);
      if (Number.isNaN(dl)) return false;
      const st = (t.status || "").toLowerCase();
      return dl < now && st !== "completed" && st !== "done";
    });
  }, [clientTasks]);

  const upcomingTasks = useMemo(() => {
    const now = Date.now();
    return clientTasks
      .filter((t) => {
        const dl = normalizeDateToMs(t.deadline);
        if (Number.isNaN(dl)) return false;
        const st = (t.status || "").toLowerCase();
        return dl >= now && st !== "completed" && st !== "done";
      })
      .sort((a, b) => (normalizeDateToMs(a.deadline) || 0) - (normalizeDateToMs(b.deadline) || 0));
  }, [clientTasks]);

  if (isListMode) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-slate-900">
              {"\u041a\u043b\u0438\u0435\u043d\u0442\u044b"}
            </div>
            <div className="text-sm text-slate-600">
              {"\u0421\u043f\u0438\u0441\u043e\u043a \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u0438\u0437 \u0437\u0430\u0434\u0430\u0447 (\u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0433\u043e API \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432)."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() => window.location.reload()}
              type="button"
            >
              {"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-4 text-slate-600">
            {"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..."}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-rose-200 p-4 text-rose-700">
            {"\u041e\u0448\u0438\u0431\u043a\u0430: "} {error}
          </div>
        ) : listItems.length === 0 ? (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-4 text-slate-600">
            {"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432. \u041d\u0443\u0436\u043d\u044b \u0437\u0430\u0434\u0430\u0447\u0438 \u0441 client_code."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {listItems.map((c) => (
              <button
                key={c.id}
                type="button"
                className="text-left rounded-xl bg-white shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 p-4"
                onClick={() => navigate(`/client-profile/${encodeURIComponent(c.id)}`)}
              >
                <div className="font-semibold text-slate-900 truncate">{c.label}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {c.id}
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    {`\u041e\u0442\u043a\u0440\u044b\u0442\u043e: ${String(c.tasks_open || 0)}`}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    {c.last_deadline ? `\u0414\u043e: ${fmtDateIsoLike(c.last_deadline)}` : "\u0411\u0435\u0437 \u0441\u0440\u043e\u043a\u043e\u0432"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const clientName = pickClientName(client);
  const taxSystem = pickTaxSystem(client);
  const responsible = pickResponsible(client);
  const inn = pickInn(client);
  const status = pickStatus(client);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            {"\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430"} {clientId ? `#${clientId}` : ""}
          </div>
          <div className="text-2xl font-semibold text-slate-900 truncate">
            {clientName || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800"
            onClick={() => navigate("/client-profile")}
            type="button"
          >
            {"\u041a \u0441\u043f\u0438\u0441\u043a\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432"}
          </button>

          <button
            className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => navigate(`/client-profile/${encodeURIComponent(clientId || "")}/edit`)}
            type="button"
            disabled={!clientId}
          >
            {"\u041f\u0440\u0430\u0432\u043a\u0430"}
          </button>

          <button
            className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => window.location.reload()}
            type="button"
          >
            {"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => {
              if (!clientId) return;
              navigate("/client-profile/" + encodeURIComponent(clientId) + "/edit");
            }}
            type="button"
            disabled={!clientId}
          >
            {"\u041f\u0440\u0430\u0432\u043a\u0430"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">{"\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435"}</div>
          <div className={"text-xs px-2 py-1 rounded-full " + badgeClass(statusToBadgeKind(status))}>
            {status ? status : "\u043d\u0435\u0442 \u0441\u0442\u0430\u0442\u0443\u0441\u0430"}
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
            <div className="text-xs text-slate-500">{"\u0418\u041d\u041d / \u043a\u043e\u0434"}</div>
            <div className="text-sm font-medium text-slate-900">{inn || s(client?.code) || "\u2014"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
            <div className="text-xs text-slate-500">{"\u0420\u0435\u0436\u0438\u043c \u043d\u0430\u043b\u043e\u0433\u043e\u043e\u0431\u043b\u043e\u0436\u0435\u043d\u0438\u044f"}</div>
            <div className="text-sm font-medium text-slate-900">{taxSystem || "\u2014"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
            <div className="text-xs text-slate-500">{"\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439"}</div>
            <div className="text-sm font-medium text-slate-900">{responsible || "\u2014"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
            <div className="text-xs text-slate-500">{"\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435"}</div>
            <div className="text-sm font-medium text-slate-900">{status || "\u2014"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="font-semibold text-slate-900">
                {"\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d\u044b\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f"}
              </div>
              <div className="text-xs text-slate-500">{"\u043d\u0435\u0442 API"}</div>
            </div>
            <div className="p-4 text-sm text-slate-600">
              {
                "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0440\u0430\u0431\u043e\u0447\u0435\u0433\u043e endpoint \u0434\u043b\u044f control-events \u0432 \u044d\u0442\u043e\u043c \u0441\u0442\u0435\u043a\u0435. \u0417\u0434\u0435\u0441\u044c \u0431\u0443\u0434\u0435\u0442 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043e \u043f\u043e\u0437\u0436\u0435."
              }
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          <TaskMiniList
            title={"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0438 \u043f\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0443"}
            tasks={overdueTasks}
            emptyText={"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u043d\u0435\u0442."}
          />

          <TaskMiniList
            title={"\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438"}
            tasks={upcomingTasks}
            emptyText={"\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0445 \u0437\u0430\u0434\u0430\u0447 \u043d\u0435\u0442."}
          />
        </div>
      </div>
    </div>
  );
}
