import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGetJson, apiPutJson } from "../api";
import { TaskCard } from "../components/tasks/TaskCard";

type ClientProfile = {
  client_code: string;
  code?: string;
  id?: string;
  label?: string;
  name?: string;
  profile_type?: string;
  tax_system?: string;
  salary_dates?: Record<string, any> | null;
  has_tourist_tax?: boolean;
  contact_email?: string;
  contact_phone?: string;
  contact_person?: string;
  settings?: Record<string, any> | null;
  updated_at?: string;
  [k: string]: any;
};

type Task = {
  id: string;
  client_code?: string;
  client_label?: string;
  title: string;
  status: string;
  priority?: string;
  deadline?: string;
  description?: string;
  [k: string]: any;
};

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

async function tryGetJson(urls: string[]): Promise<any> {
  let lastErr: any = null;
  for (const u of urls) {
    try {
      return await apiGetJson(u);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
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
  const st = (status || "").toLowerCase();
  if (["completed", "done", "ok"].includes(st)) return "ok";
  if (["overdue", "late", "expired"].includes(st)) return "bad";
  if (["in_progress", "inprogress", "working", "open", "new"].includes(st)) return "warn";
  return "muted";
}

function pickClientName(p?: ClientProfile | null): string {
  if (!p) return "";
  return s(p.name || p.label || p.code || p.client_code || p.id);
}

function pickClientCode(p?: ClientProfile | null): string {
  if (!p) return "";
  return s(p.client_code || p.code || p.id || "");
}

function TaskMiniList(props: { title: string; tasks: Task[]; emptyText: string }) {
  const { title, tasks, emptyText } = props;
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
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

function FieldRow(props: { label: string; value?: string; mono?: boolean }) {
  const { label, value, mono } = props;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="text-xs text-slate-500 shrink-0 w-40">{label}</div>
      <div className={"text-sm text-slate-900 text-right break-words " + (mono ? "font-mono" : "")}>
        {value && value.trim() ? value : "\u2014"}
      </div>
    </div>
  );
}

function PanelTitle(props: { title: string; right?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <div className="font-semibold text-slate-900">{props.title}</div>
      {props.right ? <div className="flex items-center gap-2">{props.right}</div> : null}
    </div>
  );
}

function normalizeProfilesList(data: any): ClientProfile[] {
  const arr = (data?.items ?? data?.profiles ?? data?.clients ?? data) as any;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      const p = (x?.profile ?? x) as any;
      if (!p) return null;
      const code = s(p.client_code || p.code || p.id || "");
      if (!code) return null;
      return {
        client_code: code,
        ...p,
      } as ClientProfile;
    })
    .filter(Boolean) as ClientProfile[];
}

function safeJsonParse(v: string): any | null {
  const t = (v || "").trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export default function ClientProfilePage() {
  const params = useParams();
  const navigate = useNavigate();
  const clientId = (params as any)?.id as string | undefined;

  const [list, setList] = useState<ClientProfile[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [q, setQ] = useState("");

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksErr, setTasksErr] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formLabel, setFormLabel] = useState("");
  const [formTaxSystem, setFormTaxSystem] = useState("");
  const [formHasTouristTax, setFormHasTouristTax] = useState(false);
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formSalaryDatesJson, setFormSalaryDatesJson] = useState("");

  const isListMode = !clientId;

  const clientCode = useMemo(() => (clientId ? decodeURIComponent(clientId) : ""), [clientId]);

  const filteredList = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((p) => {
      const hay = (pickClientName(p) + " " + pickClientCode(p)).toLowerCase();
      return hay.includes(qq);
    });
  }, [list, q]);

  const clientName = useMemo(() => pickClientName(profile), [profile]);

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => {
      const dl = t.deadline ? Date.parse(t.deadline) : NaN;
      if (Number.isNaN(dl)) return false;
      const st = (t.status || "").toLowerCase();
      return dl < now && st !== "completed" && st !== "done";
    });
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    const now = Date.now();
    return tasks
      .filter((t) => {
        const dl = t.deadline ? Date.parse(t.deadline) : NaN;
        if (Number.isNaN(dl)) return false;
        const st = (t.status || "").toLowerCase();
        return dl >= now && st !== "completed" && st !== "done";
      })
      .sort((a, b) => (Date.parse(a.deadline || "") || 0) - (Date.parse(b.deadline || "") || 0));
  }, [tasks]);

  function primeFormFromProfile(p: ClientProfile) {
    setFormLabel(s(p.label || p.name || ""));
    setFormTaxSystem(s(p.tax_system || ""));
    setFormHasTouristTax(Boolean(p.has_tourist_tax));
    setFormContactEmail(s(p.contact_email || p.settings?.contact_email || ""));
    setFormContactPhone(s(p.contact_phone || p.settings?.contact_phone || ""));
    setFormContactPerson(s(p.contact_person || p.settings?.contact_person || ""));
    const sd = p.salary_dates ?? p.settings?.salary_dates ?? null;
    try {
      setFormSalaryDatesJson(sd ? JSON.stringify(sd, null, 2) : "");
    } catch {
      setFormSalaryDatesJson("");
    }
  }

  async function loadList() {
    setListErr(null);
    setListLoading(true);
    try {
      const data = await tryGetJson([
        "/api/internal/client-profiles",
        "/api/internal/client-profiles?items=1",
        "/api/client-profiles",
        "/api/client-profile",
        "/api/clients",
      ]);
      const arr = normalizeProfilesList(data);
      setList(arr);
    } catch (e: any) {
      setList([]);
      setListErr(e?.message || String(e));
    } finally {
      setListLoading(false);
    }
  }

  async function loadProfileAndTasks(code: string) {
    setProfileErr(null);
    setTasksErr(null);

    setProfileLoading(true);
    try {
      const data = await tryGetJson([
        `/api/internal/client-profiles/${encodeURIComponent(code)}`,
        `/api/client-profile/${encodeURIComponent(code)}`,
        `/api/clients/${encodeURIComponent(code)}`,
      ]);
      const p = (data?.profile ?? data) as any;
      const normalized: ClientProfile = {
        client_code: s(p?.client_code || p?.code || p?.id || code),
        ...p,
      };
      setProfile(normalized);
      primeFormFromProfile(normalized);
    } catch (e: any) {
      setProfile(null);
      setProfileErr(e?.message || String(e));
    } finally {
      setProfileLoading(false);
    }

    setTasksLoading(true);
    try {
      const data = await tryGetJson([
        "/api/internal/tasks",
        `/api/tasks?client_id=${encodeURIComponent(code)}`,
        `/api/tasks/by-client/${encodeURIComponent(code)}`,
      ]);
      const arr = (data?.tasks ?? data) as any;
      const all = Array.isArray(arr) ? (arr as Task[]) : [];
      const filtered = all.filter((t) => s(t.client_code || "").toLowerCase() === code.toLowerCase());
      setTasks(filtered);
    } catch (e: any) {
      setTasks([]);
      setTasksErr(e?.message || String(e));
    } finally {
      setTasksLoading(false);
    }
  }

  useEffect(() => {
    if (isListMode) {
      loadList();
      return;
    }
    if (clientCode) {
      loadProfileAndTasks(clientCode);
    }
  }, [isListMode, clientCode]);

  async function saveProfile() {
    if (!clientCode) return;
    setSaveErr(null);

    const salaryDates = safeJsonParse(formSalaryDatesJson);

    const payload: any = {
      client_code: clientCode,
      label: formLabel.trim() ? formLabel.trim() : undefined,
      tax_system: formTaxSystem.trim() ? formTaxSystem.trim() : undefined,
      has_tourist_tax: Boolean(formHasTouristTax),
      contact_email: formContactEmail.trim() ? formContactEmail.trim() : undefined,
      contact_phone: formContactPhone.trim() ? formContactPhone.trim() : undefined,
      contact_person: formContactPerson.trim() ? formContactPerson.trim() : undefined,
      salary_dates: salaryDates ? salaryDates : undefined,
    };

    setSaving(true);
    try {
      const data = await apiPutJson(`/api/internal/client-profiles/${encodeURIComponent(clientCode)}`, payload);
      const p = (data?.profile ?? data) as any;
      const normalized: ClientProfile = {
        client_code: s(p?.client_code || p?.code || p?.id || clientCode),
        ...p,
      };
      setProfile(normalized);
      primeFormFromProfile(normalized);
      setEditOpen(false);
    } catch (e: any) {
      setSaveErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {isListMode ? (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <PanelTitle
              title={"\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432"}
              right={
                <button
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
                  onClick={loadList}
                  disabled={listLoading}
                >
                  {listLoading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
                </button>
              }
            />
            <div className="p-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex-1">
                  <input
                    className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder={"\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0438\u043c\u0435\u043d\u0438 \u0438\u043b\u0438 \u043a\u043e\u0434\u0443..."}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500">{`\u0412\u0441\u0435\u0433\u043e: ${filteredList.length}`}</div>
              </div>

              {listErr ? <div className="mt-3 text-sm text-rose-700">{listErr}</div> : null}

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredList.map((p) => {
                  const code = pickClientCode(p);
                  const name = pickClientName(p);
                  const kind = badgeClass(statusToBadgeKind("ok"));
                  return (
                    <button
                      key={code}
                      className="text-left rounded-xl bg-slate-50 ring-1 ring-slate-100 hover:bg-slate-100 px-4 py-3 transition"
                      onClick={() => navigate(`/client-profile/${encodeURIComponent(code)}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">{name || code}</div>
                          <div className="text-xs text-slate-500 truncate">{code}</div>
                        </div>
                        <div className={"text-xs px-2 py-1 rounded-full " + kind}>{"ok"}</div>
                      </div>
                    </button>
                  );
                })}
                {filteredList.length === 0 && !listLoading ? (
                  <div className="text-sm text-slate-500">{`\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u0438\u043b\u0438 \u0441\u043f\u0438\u0441\u043e\u043a \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d.`}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">
                  {"\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430"} {clientCode ? `#${clientCode}` : ""}
                </div>
                <div className="text-2xl font-semibold text-slate-900 truncate">
                  {profileLoading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : clientName || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f"}
                </div>
                {profileErr ? <div className="text-sm text-rose-700 mt-1">{profileErr}</div> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
                  onClick={() => navigate("/client-profile")}
                >
                  {"\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432"}
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
                  disabled={!profile || profileLoading}
                  onClick={() => {
                    if (!profile) return;
                    primeFormFromProfile(profile);
                    setEditOpen(true);
                  }}
                >
                  {"\u041f\u0440\u0430\u0432\u043a\u0430"}
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
                  onClick={() => clientCode && loadProfileAndTasks(clientCode)}
                >
                  {"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <PanelTitle title={"\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435"} />
                  <div className="p-5">
                    <div className="space-y-1">
                      <FieldRow label={"\u041a\u043e\u0434"} value={clientCode} mono />
                      <FieldRow label={"\u0420\u0435\u0436\u0438\u043c"} value={s(profile?.tax_system)} />
                      <FieldRow
                        label={"\u0422\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0441\u0431\u043e\u0440"}
                        value={profile?.has_tourist_tax ? "\u0434\u0430" : "\u043d\u0435\u0442"}
                      />
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-700 mb-2">
                          {"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"}
                        </div>
                        <FieldRow label={"\u042d\u043b. \u043f\u043e\u0447\u0442\u0430"} value={s(profile?.contact_email || profile?.settings?.contact_email)} />
                        <FieldRow label={"\u0422\u0435\u043b\u0435\u0444\u043e\u043d"} value={s(profile?.contact_phone || profile?.settings?.contact_phone)} />
                        <FieldRow label={"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e"} value={s(profile?.contact_person || profile?.settings?.contact_person)} />
                      </div>
                    </div>

                    {profile?.updated_at ? (
                      <div className="mt-4 text-xs text-slate-400">
                        {`\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u043e: ${fmtDateIsoLike(s(profile.updated_at))}`}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-5">
                <TaskMiniList
                  title={"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0438 \u043f\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0443"}
                  tasks={overdueTasks}
                  emptyText={
                    tasksErr
                      ? `\u041e\u0448\u0438\u0431\u043a\u043a\u0430: ${tasksErr}`
                      : "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447 \u043d\u0435\u0442."
                  }
                />

                <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                  <PanelTitle
                    title={"\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438"}
                    right={<div className="text-xs text-slate-500">{tasksLoading ? "\u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430" : `${upcomingTasks.length}`}</div>}
                  />
                  <div className="p-3 space-y-3">
                    {upcomingTasks.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        {tasksErr ? `\u041e\u0448\u0438\u0431\u043a\u043a\u0430: ${tasksErr}` : "\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0445 \u0437\u0430\u0434\u0430\u0447 \u043d\u0435\u0442."}
                      </div>
                    ) : (
                      upcomingTasks.slice(0, 10).map((t) => <TaskCard key={t.id} task={t as any} />)
                    )}
                  </div>
                </div>
              </div>
            </div>

            {editOpen ? (
              <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 p-3">
                <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
                  <PanelTitle
                    title={"\u041f\u0440\u0430\u0432\u043a\u0430 \u043f\u0440\u043e\u0444\u0438\u043b\u044f"}
                    right={
                      <button
                        className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
                        onClick={() => setEditOpen(false)}
                      >
                        {"\u0417\u0430\u043a\u0440\u044b\u0442\u044c"}
                      </button>
                    }
                  />

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">{"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 / \u043b\u0435\u0439\u0431\u043b"}</label>
                        <input
                          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={formLabel}
                          onChange={(e) => setFormLabel(e.target.value)}
                          placeholder={"\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: Demo Client A"}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">{"\u0420\u0435\u0436\u0438\u043c \u043d\u0430\u043b\u043e\u0433\u043e\u043e\u0431\u043b\u043e\u0436\u0435\u043d\u0438\u044f"}</label>
                        <input
                          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={formTaxSystem}
                          onChange={(e) => setFormTaxSystem(e.target.value)}
                          placeholder={"\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: USN_DR"}
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center gap-2">
                        <input
                          id="hasTouristTax"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={formHasTouristTax}
                          onChange={(e) => setFormHasTouristTax(e.target.checked)}
                        />
                        <label htmlFor="hasTouristTax" className="text-sm text-slate-800">
                          {"\u041f\u043b\u0430\u0442\u0435\u043b\u044c\u0449\u0438\u043a \u0442\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e \u0441\u0431\u043e\u0440\u0430"}
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">{"\u042d\u043b. \u043f\u043e\u0447\u0442\u0430"}</label>
                        <input
                          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={formContactEmail}
                          onChange={(e) => setFormContactEmail(e.target.value)}
                          placeholder={"ivan@example.com"}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">{"\u0422\u0435\u043b\u0435\u0444\u043e\u043d"}</label>
                        <input
                          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={formContactPhone}
                          onChange={(e) => setFormContactPhone(e.target.value)}
                          placeholder={"+79990001122"}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-600 mb-1">{"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e"}</label>
                        <input
                          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                          value={formContactPerson}
                          onChange={(e) => setFormContactPerson(e.target.value)}
                          placeholder={"Ivan Petrov"}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-600 mb-1">
                          {"\u0414\u0430\u0442\u044b \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u044b (JSON)"}
                        </label>
                        <textarea
                          className="w-full min-h-[120px] px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono text-xs"
                          value={formSalaryDatesJson}
                          onChange={(e) => setFormSalaryDatesJson(e.target.value)}
                          placeholder={"{\n  \"salary_1\": \"05\",\n  \"salary_2\": \"20\"\n}"}
                        />
                        <div className="mt-1 text-xs text-slate-400">
                          {"\u041e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043f\u0443\u0441\u0442\u044b\u043c, \u0435\u0441\u043b\u0438 \u043d\u0435 \u043d\u0443\u0436\u043d\u043e."}
                        </div>
                      </div>
                    </div>

                    {saveErr ? <div className="text-sm text-rose-700">{saveErr}</div> : null}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
                        onClick={() => setEditOpen(false)}
                        disabled={saving}
                      >
                        {"\u041e\u0442\u043c\u0435\u043d\u0430"}
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
                        onClick={saveProfile}
                        disabled={saving}
                      >
                        {saving ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e..." : "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
