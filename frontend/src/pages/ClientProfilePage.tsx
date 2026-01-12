import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { apiGetJson } from "../api";
import { useSidePanel } from "../components/ux/SidePanelEngine";
import { TaskCard } from "../components/tasks/TaskCard";

type ClientProfile = {
  client_code: string;
  code?: string;
  id?: string;
  label?: string;
  name?: string;
  tax_system?: string;
  has_tourist_tax?: boolean;
  updated_at?: string;
  settings?: any;
  contact_email?: string;
  contact_phone?: string;
  contact_person?: string;
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
  [k: string]: any;
};

function t(key: string): string {
  const d: Record<string, string> = {
    clients: "\u041a\u043b\u0438\u0435\u043d\u0442\u044b",
    listKicker: "\u0421\u043f\u0438\u0441\u043e\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432",
    listLead: "\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u043e\u0438\u0441\u043a, \u0444\u0438\u043b\u044c\u0442\u0440\u044b \u0438 \u043f\u0435\u0440\u0435\u0445\u043e\u0434 \u0432 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443.",
    search: "\u041f\u043e\u0438\u0441\u043a",
    searchPh: "\u0418\u043c\u044f, \u043a\u043e\u0434 \u0438\u043b\u0438 \u0440\u0435\u0436\u0438\u043c...",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    create: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
    open: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c",
    tax: "\u0420\u0435\u0436\u0438\u043c",
    tourist: "\u0422\u0443\u0440\u0441\u0431\u043e\u0440",
    status: "\u0421\u0442\u0430\u0442\u0443\u0441",
    yes: "\u0434\u0430",
    no: "\u043d\u0435\u0442",
    okRu: "\u0412 \u0441\u0440\u043e\u043a",
    soonRu: "\u0421\u043a\u043e\u0440\u043e",
    overdueRu: "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    emptyTitle: "\u041a\u043b\u0438\u0435\u043d\u0442\u044b",
    emptyBody:
      "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438\u043b\u0438 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435.",
    count: "\u0412\u0441\u0435\u0433\u043e",
    errLoad: "\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438",
    backToList: "\u0421\u043f\u0438\u0441\u043e\u043a",
    edit: "\u041f\u0440\u0430\u0432\u043a\u0430",
    profile: "\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
    overview: "\u041e\u0431\u0437\u043e\u0440",
    contacts: "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b",
    upcoming: "\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0435\u0435",
    overdueTasks: "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0438",
    noTasks: "\u0417\u0430\u0434\u0430\u0447 \u043d\u0435\u0442.",
    close: "\u0417\u0430\u043a\u0440\u044b\u0442\u044c",
  };
  return d[key] || key;
}

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

async function tryGetJson(urls: string[]): Promise<any> {
  let last: any = null;
  for (const u of urls) {
    try {
      return await apiGetJson(u);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function pickClientName(p: ClientProfile): string {
  return s(p.name || p.label || p.client_code || p.code || p.id || "");
}

function pickClientCode(p: ClientProfile): string {
  return s(p.client_code || p.code || p.id || "");
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
      return { client_code: code, ...p } as ClientProfile;
    })
    .filter(Boolean) as ClientProfile[];
}

function fmtDateIsoLike(v?: string): string {
  if (!v) return "";
  const t0 = v.replace("T", " ").replace("Z", "");
  return t0.length > 16 ? t0.slice(0, 16) : t0;
}

function computeTaskKind(tt: Task): "overdue" | "soon" | "ok" {
  const dl = tt.deadline ? Date.parse(tt.deadline) : NaN;
  const st = (tt.status || "").toLowerCase();
  const done = st === "completed" || st === "done";
  if (done) return "ok";
  if (Number.isNaN(dl)) return "soon";
  const now = Date.now();
  if (dl < now) return "overdue";
  if (dl - now <= 72 * 3600 * 1000) return "soon";
  return "ok";
}

function pillStyle(kind: "overdue" | "soon" | "ok" | "muted"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: "16px",
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(15,23,42,0.04)",
    color: "rgb(30,41,59)",
    whiteSpace: "nowrap",
  };

  if (kind === "ok") {
    return { ...base, background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.25)", color: "rgb(6,95,70)" };
  }
  if (kind === "soon") {
    return { ...base, background: "rgba(245,158,11,0.16)", border: "1px solid rgba(245,158,11,0.30)", color: "rgb(146,64,14)" };
  }
  if (kind === "overdue") {
    return { ...base, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.25)", color: "rgb(153,27,27)" };
  }
  return base;
}

function EmptyState(props: { title: string; body: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <div className="erp-card" style={{ padding: 20 }}>
      <div className="text-lg font-semibold text-slate-900">{props.title}</div>
      <div className="mt-2 text-sm text-slate-600">{props.body}</div>
      {props.ctaLabel && props.onCta ? (
        <div className="mt-4">
          <button className="erp-btn erp-btn-primary" onClick={props.onCta}>
            {props.ctaLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GridRow(props: { head?: boolean; onClick?: () => void; children: any; sticky?: boolean }) {
  const base: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "2.2fr 1fr 0.85fr 0.95fr 0.8fr",
    gap: 12,
    alignItems: "center",
  };

  const headStyle: CSSProperties = {
    position: props.sticky ? ("sticky" as any) : undefined,
    top: props.sticky ? 0 : undefined,
    zIndex: props.sticky ? 2 : undefined,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: props.sticky ? "blur(8px)" : undefined,
  };

  const cls = props.head
    ? "px-4 py-3 text-xs font-semibold text-slate-500 border-b"
    : "px-4 py-3 text-sm border-b hover:bg-slate-50 cursor-pointer";

  return (
    <div
      style={{ ...base, ...(props.head ? headStyle : {}) }}
      className={cls}
      role={props.onClick ? "button" : undefined}
      tabIndex={props.onClick ? 0 : undefined}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (!props.onClick) return;
        if (e.key === "Enter" || e.key === " ") props.onClick();
      }}
    >
      {props.children}
    </div>
  );
}

export default function ClientProfilePage() {
  const { openPanel, closePanel } = useSidePanel();
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const clientId = (params as any)?.id as string | undefined;

  const isListMode = !clientId;
  const clientCode = useMemo(() => (clientId ? decodeURIComponent(clientId) : ""), [clientId]);

  const [list, setList] = useState<ClientProfile[]>([]);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [q, setQ] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksErr, setTasksErr] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);

  const selectedClientCode = useMemo(() => {
    const raw = searchParams.get("client");
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [searchParams]);

  function openClientPanel(code: string) {
    const next = new URLSearchParams(searchParams);
    next.set("client", encodeURIComponent(code));
    setSearchParams(next);
  }

  function closeClientPanel() {
    const next = new URLSearchParams(searchParams);
    next.delete("client");
    setSearchParams(next);
  }

  const filteredList = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((p) => {
      const hay = (pickClientName(p) + " " + pickClientCode(p) + " " + s(p.tax_system || "")).toLowerCase();
      return hay.includes(qq);
    });
  }, [list, q]);

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
      setList(normalizeProfilesList(data));
    } catch (e: any) {
      setList([]);
      setListErr(t("errLoad") + ": " + String(e?.message || e || "error"));
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
      setProfile({ client_code: s(p?.client_code || p?.code || p?.id || code), ...p });
    } catch (e: any) {
      setProfile(null);
      setProfileErr(String(e?.message || e || "error"));
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
      const filtered = all.filter((x) => s(x.client_code || "").toLowerCase() === code.toLowerCase());
      setTasks(filtered);
    } catch (e: any) {
      setTasks([]);
      setTasksErr(String(e?.message || e || "error"));
    } finally {
      setTasksLoading(false);
    }
  }

  // Load data
  useEffect(() => {
    if (isListMode) {
      void loadList();
      return;
    }
    if (clientCode) void loadProfileAndTasks(clientCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListMode, clientCode]);

  useEffect(() => {
    if (!isListMode) return;
    if (!selectedClientCode) return;
    void loadProfileAndTasks(selectedClientCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListMode, selectedClientCode]);

  // Close panel on Esc (only list mode)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isListMode && selectedClientCode) closeClientPanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListMode, selectedClientCode]);

    // Deep-link: /client-profile/:id -> list mode with panel
  // IMPORTANT: Do not hijack /client-profile/:id/edit (edit UX must stay on edit route).
  useEffect(() => {
    if (!isListMode && clientCode) {
      const p = location.pathname || "";
      if (p.endsWith("/edit")) return;
      navigate(`/client-profile?client=${encodeURIComponent(clientCode)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListMode, clientCode, location.pathname]);


  // SidePanelEngine binding (list mode only)
  useEffect(() => {
    if (!isListMode) return;

    if (!selectedClientCode) {
      closePanel();
      return;
    }

    const code = selectedClientCode;
    const title = "\u041a\u043b\u0438\u0435\u043d\u0442";
    const subtitle = code;

    openPanel({
      title,
      subtitle,
      actions: (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="erp-btn erp-btn-primary" type="button" onClick={() => { closePanel(); closeClientPanel(); navigate(`/client-profile/${encodeURIComponent(code)}/edit`); }}>
            {"\u041f\u0440\u0430\u0432\u043a\u0430"}
          </button>
          <button className="erp-btn" type="button" onClick={() => navigate("/control")}>
            {"\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c"}
          </button>
          <button className="erp-btn" type="button" onClick={() => navigate("/tasks")}>
            {"\u0417\u0430\u0434\u0430\u0447\u0438"}
          </button>
          <button className="erp-btn" type="button" onClick={() => { closePanel(); closeClientPanel(); navigate(`/client-profile/${encodeURIComponent(code)}`); }}>
            {"\u041f\u043e\u043b\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430"}
          </button>
          <button className="erp-btn" type="button" onClick={() => closeClientPanel()}>
            {t("close")}
          </button>
        </div>
      ),
      sections: [
        {
          title: "\u041e\u0431\u0437\u043e\u0440",
          content: profileErr ? (
            <div className="erp-alert erp-alert-danger">{profileErr}</div>
          ) : (
            <div className="erp-kv">
              <div className="erp-kv-row">
                <div className="erp-kv-k">{"Name"}</div>
                <div className="erp-kv-v">{profileLoading ? t("loading") : profile ? pickClientName(profile) : code}</div>
              </div>
              <div className="erp-kv-row">
                <div className="erp-kv-k">{t("tax")}</div>
                <div className="erp-kv-v">{s(profile?.tax_system) || "\u2014"}</div>
              </div>
              <div className="erp-kv-row">
                <div className="erp-kv-k">{t("tourist")}</div>
                <div className="erp-kv-v">{profile?.has_tourist_tax ? t("yes") : t("no")}</div>
              </div>
              <div className="erp-kv-row">
                <div className="erp-kv-k">{"Email"}</div>
                <div className="erp-kv-v">{s(profile?.contact_email || profile?.settings?.contact_email) || "\u2014"}</div>
              </div>
            </div>
          ),
        },
        {
          title: "\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0435\u0435",
          content: tasksErr ? (
            <div className="erp-alert erp-alert-danger">{tasksErr}</div>
          ) : tasksLoading ? (
            <div className="erp-muted">{t("loading")}</div>
          ) : tasks.length === 0 ? (
            <div className="erp-muted">{t("noTasks")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {tasks
                .slice()
                .sort((a, b) => (Date.parse(a.deadline || "") || 0) - (Date.parse(b.deadline || "") || 0))
                .slice(0, 8)
                .map((tt) => (
                  <TaskCard key={tt.id} task={tt as any} />
                ))}
            </div>
          ),
        },
      ],
      widthPx: 560,
      onClose: () => closeClientPanel(),
    });
  }, [isListMode, selectedClientCode, openPanel, closePanel, navigate, profile, profileErr, profileLoading, tasks, tasksErr, tasksLoading]);

  const clientName = useMemo(() => (profile ? pickClientName(profile) : ""), [profile]);

  const overdueTasks = useMemo(() => tasks.filter((x) => computeTaskKind(x) === "overdue"), [tasks]);
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((x) => computeTaskKind(x) !== "overdue")
      .sort((a, b) => (Date.parse(a.deadline || "") || 0) - (Date.parse(b.deadline || "") || 0));
  }, [tasks]);

  if (isListMode) {
    return (
      <div className="erp-page">
        <div className="erp-page-inner">
          <div className="erp-page-head">
            <div className="min-w-0">
              <div className="erp-kicker">{t("listKicker")}</div>
              <div className="erp-h1">{t("clients")}</div>
              <div className="mt-1 text-sm text-slate-500">{t("listLead")}</div>
            </div>

            <div className="flex items-center gap-2">
              <button className="erp-btn" onClick={loadList} disabled={listLoading}>
                {listLoading ? t("loading") : t("refresh")}
              </button>
              <button className="erp-btn erp-btn-primary" onClick={() => navigate("/client-create")}>
                {t("create")}
              </button>
            </div>
          </div>

          <div className="erp-card" style={{ padding: 12 }}>
            <div className="erp-filters">
              <div className="erp-field">
                <div className="erp-label">{t("search")}</div>
                <input className="erp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} />
              </div>
              <div className="erp-field" style={{ justifySelf: "end" }}>
                <div className="erp-label">{t("count")}</div>
                <div className="text-sm text-slate-700">{String(filteredList.length)}</div>
              </div>
            </div>
          </div>

          {listErr ? <div className="erp-alert erp-alert-danger">{listErr}</div> : null}

          {filteredList.length === 0 && !listLoading ? (
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} ctaLabel={t("create")} onCta={() => navigate("/client-create")} />
          ) : (
            <div className="erp-card" style={{ padding: 0, overflow: "hidden" }}>
              <GridRow head sticky>
                <div className="min-w-0">{t("clients")}</div>
                <div className="min-w-0">{t("tax")}</div>
                <div className="min-w-0">{t("tourist")}</div>
                <div className="min-w-0">{t("status")}</div>
                <div className="text-right">{t("open")}</div>
              </GridRow>

              {filteredList.map((p) => {
                const code = pickClientCode(p);
                const name = pickClientName(p) || code;
                const tax = s(p.tax_system || "");
                const tt = Boolean(p.has_tourist_tax);

                const status: "ok" | "soon" = tt ? "soon" : "ok";

                return (
                  <GridRow key={code} onClick={() => openClientPanel(code)}>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-500 truncate">{code}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm text-slate-800 truncate">{tax || "\u2014"}</div>
                    </div>

                    <div className="min-w-0">
                      <span style={tt ? pillStyle("soon") : pillStyle("muted")}>{tt ? t("yes") : t("no")}</span>
                    </div>

                    <div className="min-w-0">
                      <span style={pillStyle(status)}>{status === "ok" ? t("okRu") : t("soonRu")}</span>
                    </div>

                    <div className="text-right">
                      <button
                        className="erp-btn erp-btn-primary erp-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openClientPanel(code);
                        }}
                      >
                        {t("open")}
                      </button>
                    </div>
                  </GridRow>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="erp-page">
      <div className="erp-page-inner">
        <div className="erp-page-head">
          <div className="min-w-0">
            <div className="erp-kicker">
              {t("profile")} {clientCode ? `#${clientCode}` : ""}
            </div>
            <div className="erp-h1">{profileLoading ? t("loading") : clientName || "\u2014"}</div>
            {profileErr ? (
              <div className="erp-alert erp-alert-danger" style={{ marginTop: 10 }}>
                {profileErr}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button className="erp-btn" onClick={() => navigate("/client-profile")}>
              {t("backToList")}
            </button>
            <button className="erp-btn erp-btn-primary" onClick={() => navigate(`/client-profile/${encodeURIComponent(clientCode)}/edit`)} disabled={!clientCode}>
              {t("edit")}
            </button>
            <button className="erp-btn" onClick={() => clientCode && loadProfileAndTasks(clientCode)}>
              {t("refresh")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div className="erp-card" style={{ padding: 16 }}>
              <div className="erp-card-title">{t("overview")}</div>
              <div className="erp-kv">
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Code"}</div>
                  <div className="erp-kv-v font-mono text-xs">{clientCode}</div>
                </div>
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{t("tax")}</div>
                  <div className="erp-kv-v">{s(profile?.tax_system) || "\u2014"}</div>
                </div>
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{t("tourist")}</div>
                  <div className="erp-kv-v">
                    <span style={Boolean(profile?.has_tourist_tax) ? pillStyle("soon") : pillStyle("muted")}>
                      {Boolean(profile?.has_tourist_tax) ? t("yes") : t("no")}
                    </span>
                  </div>
                </div>
                {profile?.updated_at ? (
                  <div className="erp-kv-row">
                    <div className="erp-kv-k">{"Updated"}</div>
                    <div className="erp-kv-v text-xs text-slate-600">{fmtDateIsoLike(s(profile.updated_at))}</div>
                  </div>
                ) : null}
              </div>

              <div className="erp-sep" />

              <div className="erp-card-title">{t("contacts")}</div>
              <div className="erp-kv">
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Email"}</div>
                  <div className="erp-kv-v">{s(profile?.contact_email || profile?.settings?.contact_email) || "\u2014"}</div>
                </div>
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Phone"}</div>
                  <div className="erp-kv-v">{s(profile?.contact_phone || profile?.settings?.contact_phone) || "\u2014"}</div>
                </div>
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Person"}</div>
                  <div className="erp-kv-v">{s(profile?.contact_person || profile?.settings?.contact_person) || "\u2014"}</div>
                </div>
              </div>
            </div>

            <div className="erp-card" style={{ padding: 16 }}>
              <div className="erp-card-title">{t("overdueTasks")}</div>
              <div className="mt-3 space-y-3">
                {tasksLoading ? <div className="text-sm text-slate-500">{t("loading")}</div> : null}
                {tasksErr ? <div className="erp-alert erp-alert-danger">{tasksErr}</div> : null}
                {overdueTasks.length === 0 && !tasksLoading && !tasksErr ? (
                  <div className="text-sm text-slate-600">{t("noTasks")}</div>
                ) : (
                  overdueTasks.slice(0, 6).map((tt) => <TaskCard key={tt.id} task={tt as any} />)
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="erp-card" style={{ padding: 0 }}>
              <div className="erp-card-head">
                <div className="erp-card-title">{t("upcoming")}</div>
                <div className="text-xs text-slate-500">{tasksLoading ? t("loading") : String(upcomingTasks.length)}</div>
              </div>
              <div style={{ padding: 12 }} className="space-y-3">
                {tasksErr ? <div className="erp-alert erp-alert-danger">{tasksErr}</div> : null}
                {upcomingTasks.length === 0 && !tasksLoading ? (
                  <div className="text-sm text-slate-600">{t("noTasks")}</div>
                ) : (
                  upcomingTasks.slice(0, 12).map((tt) => {
                    const kind = computeTaskKind(tt);
                    const label = kind === "ok" ? t("okRu") : kind === "soon" ? t("soonRu") : t("overdueRu");
                    return (
                      <div key={tt.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 truncate">{s(tt.title) || "\u2014"}</div>
                          <div className="text-xs text-slate-500 truncate">
                            {(tt.deadline ? fmtDateIsoLike(tt.deadline) : "\u2014") + " \u00b7 " + s(tt.status || "")}
                          </div>
                        </div>
                        <span style={pillStyle(kind)}>{label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="erp-card" style={{ padding: 16 }}>
              <div className="erp-card-title">{"Notes"}</div>
              <div className="mt-2 text-sm text-slate-600">{"Reserved for client control narrative (risks, filings, document requests)."}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
