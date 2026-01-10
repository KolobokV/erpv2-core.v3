import { useEffect, useMemo, useRef, useState } from "react";
import { SharedDocsBlock } from "../components/sharedDocs/SharedDocsBlock";
import { apiGetJson } from "../api";
import "../ux/dayDashboard.css";
import "../ux/sharedDocs.css";

type Task = {
  id: string;
  client_code?: string;
  client_label?: string;
  title: string;
  status: string;
  priority?: string;
  deadline?: string;
};

type ProcessInstance = {
  id: string;
  client_code?: string;
  client_label?: string;
  period?: string;
  status?: string;
  deadline?: string;
  due_date?: string;
};

type StoredAttachment = {
  name: string;
  mime: string;
  data_url: string;
  added_at: string;
};

type AttachmentIndex = Record<string, StoredAttachment[]>;

type ManualTaskStatus = "todo" | "in_progress" | "done";

type ManualTask = {
  id: string;
  title: string;
  note?: string;
  assignee?: string;
  due_date?: string | null; // YYYY-MM-DD
  status: ManualTaskStatus;
  pinned?: boolean;
  created_at: string; // ISO
  updated_at: string; // ISO
};

const LS_ATTACH_KEY = "erpv2_task_attachments_v1";
const LS_MANUAL_KEY = "erpv2_manual_tasks_v1";

const LS_DEMO_REGL_TASKS = "erpv2_demo_reglement_tasks_v1";

function loadDemoReglementTasks(): Task[] {
  try {
    const raw = localStorage.getItem(LS_DEMO_REGL_TASKS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveDemoReglementTasks(items: Task[]) {
  try {
    localStorage.setItem(LS_DEMO_REGL_TASKS, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function genDemoReglementTasks(now: Date): Task[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const base = new Date(y, m, 1);
  const out: Task[] = [];

  const clients = [
    { code: "demo_a", label: "Demo Client A" },
    { code: "demo_b", label: "Demo Client B" },
    { code: "demo_c", label: "Demo Client C" },
  ];

  const titles = [
    "Bank statement request",
    "Document request",
    "USN advance",
    "Payroll check",
    "VAT draft",
    "Reconcile with counterparty",
    "Primary docs review",
    "Contact client",
    "Tax payment reminder",
  ];

  let idn = 1;
  for (const c of clients) {
    for (let i = 0; i < 28; i++) {
      const d = new Date(base.getTime());
      d.setDate(1 + i * 2 + (c.code === "demo_b" ? 1 : 0));
      d.setMonth(m + (i > 18 ? 1 : 0));
      const deadline = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);

      const title = titles[(i + (c.code === "demo_c" ? 3 : 0)) % titles.length];
      out.push({
        id: "demo_regl_" + c.code + "_" + (idn++).toString().padStart(4, "0"),
        client_code: c.code,
        client_label: c.label,
        title: title + " (" + isoDateOnly(deadline).slice(0, 7) + ")",
        status: "open",
        priority: i % 7 === 0 ? "high" : "normal",
        deadline,
      });
    }
  }

  return out;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function nowIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}`;
}

function toDateSafe(x: any): Date | null {
  if (!x) return null;

  if (x instanceof Date) {
    if (Number.isNaN(x.getTime())) return null;
    return x;
  }

  if (typeof x === "number") {
    const dt = new Date(x);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  if (typeof x === "string") {
    const m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d);
      if (Number.isNaN(dt.getTime())) return null;
      return dt;
    }
    const dt = new Date(x);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  if (typeof x === "object") {
    const v = (x as any).deadline ?? (x as any).due_date ?? (x as any).dueDate ?? (x as any).date ?? (x as any).value;
    if (v && v !== x) return toDateSafe(v);
  }

  return null;
}

function isoDateLocal(d: any): string {
  const dt = toDateSafe(d);
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoDateOnly(d: any): string {
  return isoDateLocal(d);
}

function parseDateOnly(s?: any): Date | null {
  return toDateSafe(s);
}

function isOverdueBackend(task: Task, today: Date): boolean {
  const dd = parseDateOnly(task.deadline);
  if (!dd) return false;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d0 = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate());
  return d0.getTime() < t0.getTime() && String(task.status || "").toLowerCase() !== "done";
}

function isTodayBackend(task: Task, today: Date): boolean {
  const dd = parseDateOnly(task.deadline);
  if (!dd) return false;
  return isoDateLocal(dd) === isoDateLocal(today);
}

function isLegacyUrgentBackend(task: Task): boolean {
  const pr = String(task.priority || "").toLowerCase();
  const noDeadline = !task.deadline;
  const t = String(task.title || "").trim();
  return ((pr === "urgent" || pr === "high" || pr === "p1") && noDeadline) || t.startsWith("!");
}

function groupTasksByDateBackend(tasks: Task[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {};
  for (const t of tasks) {
    const dd = parseDateOnly(t.deadline);
    if (!dd) continue;
    const key = isoDateLocal(dd);
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return map;
}

function groupManualByDate(tasks: ManualTask[]): Record<string, ManualTask[]> {
  const map: Record<string, ManualTask[]> = {};
  for (const t of tasks) {
    const dd = parseDateOnly(t.due_date || undefined);
    if (!dd) continue;
    const key = isoDateLocal(dd);
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return map;
}

function monthGrid(year: number, monthIndex0: number): Date[] {
  const first = new Date(year, monthIndex0, 1);
  const firstDow = (first.getDay() + 6) % 7; // 0=Mon .. 6=Sun
  const start = new Date(year, monthIndex0, 1 - firstDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

function loadIndex(): AttachmentIndex {
  try {
    const raw = localStorage.getItem(LS_ATTACH_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as AttachmentIndex;
  } catch {
    // ignore
  }
  return {};
}

function saveIndex(idx: AttachmentIndex) {
  try {
    localStorage.setItem(LS_ATTACH_KEY, JSON.stringify(idx));
  } catch {
    // ignore
  }
}

function loadManualTasks(): ManualTask[] {
  try {
    const raw = localStorage.getItem(LS_MANUAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x === "object" && typeof x.id === "string" && typeof x.title === "string")
      .map((x) => ({
        id: String(x.id),
        title: String(x.title),
        note: typeof x.note === "string" ? x.note : "",
        assignee: typeof x.assignee === "string" ? x.assignee : "",
        due_date: typeof x.due_date === "string" ? x.due_date : null,
        status: (x.status === "in_progress" || x.status === "done" ? x.status : "todo") as ManualTaskStatus,
        pinned: Boolean((x as any).pinned),
        created_at: typeof x.created_at === "string" ? x.created_at : nowIso(),
        updated_at: typeof x.updated_at === "string" ? x.updated_at : nowIso(),
      }));
  } catch {
    return [];
  }
}

function saveManualTasks(items: ManualTask[]) {
  try {
    localStorage.setItem(LS_MANUAL_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function makeId(): string {
  const a = Math.random().toString(16).slice(2);
  const b = Date.now().toString(16);
  return `m_${b}_${a}`;
}

async function fileToDataUrl(file: File): Promise<{ mime: string; dataUrl: string }> {
  const mime = file.type || "application/octet-stream";
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("file read failed"));
    r.readAsDataURL(file);
  });
  return { mime, dataUrl };
}

function statusLabel(s: ManualTaskStatus): string {
  if (s === "todo") return "\u041d\u0435 \u043d\u0430\u0447\u0430\u0442\u043e";
  if (s === "in_progress") return "\u0412 \u0440\u0430\u0431\u043e\u0442\u0435";
  return "\u0413\u043e\u0442\u043e\u0432\u043e";
}

function normalizeManualQuery(s: string): string {
  return String(s || "").trim().toLowerCase();
}

function compareManual(a: ManualTask, b: ManualTask): number {
  const ap = a.pinned ? 1 : 0;
  const bp = b.pinned ? 1 : 0;
  if (ap !== bp) return bp - ap;

  const sRank = (x: ManualTaskStatus) => (x === "todo" ? 0 : x === "in_progress" ? 1 : 2);
  const ar = sRank(a.status);
  const br = sRank(b.status);
  if (ar !== br) return ar - br;

  const ad = a.due_date ? a.due_date : "9999-99-99";
  const bd = b.due_date ? b.due_date : "9999-99-99";
  if (ad !== bd) return ad.localeCompare(bd);

  return String(b.updated_at).localeCompare(String(a.updated_at));
}

function formatDateRu(d: Date | null | undefined): string {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}.${mm}.${yy}`;
}
type ClientProfile = {
  id: string;
  name: string;
  client_code?: string;
};

export default function DayDashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientQ, setClientQ] = useState<string>("");
  const [proc, setProc] = useState<ProcessInstance[]>([]);
  const [manual, setManual] = useState<ManualTask[]>(() => loadManualTasks());

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [calMonth, setCalMonth] = useState<number>(today.getMonth());
  const [calYear, setCalYear] = useState<number>(today.getFullYear());
  const [calSelectedIso, setCalSelectedIso] = useState<string | null>(null);

  // Manual quick-create
  const [mTitle, setMTitle] = useState<string>("");
  const [mNote, setMNote] = useState<string>("");
  const [mAssignee, setMAssignee] = useState<string>("");
  const [mDue, setMDue] = useState<string>("");
  const [uiErr, setUiErr] = useState<string | null>(null);

  // Manual filter
  const [mQuery, setMQuery] = useState<string>("");
  const [mShowDone, setMShowDone] = useState<boolean>(false);

  const [attIdx, setAttIdx] = useState<AttachmentIndex>(() => loadIndex());
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  async function reloadBackend() {
    setLoading(true);
    setErr(null);
    try {
      const [t, p] = await Promise.all([
        apiGetJson("/api/internal/tasks"),
        apiGetJson("/api/internal/process-instances-v2/"),
      ]);
      const backendTasks = Array.isArray(t) ? t : [];
      const demo = loadDemoReglementTasks();
      setTasks(backendTasks.length > 0 ? backendTasks : demo);

      setProc(Array.isArray(p) ? p : []);
      setAttIdx(loadIndex());
    } catch (e: any) {
      setErr(String(e?.message || e || "error"));
      setTasks([]);
      setProc([]);
    } finally {
      setLoading(false);
    }
  }

  function generateDemoCalendarData() {
    const demo = genDemoReglementTasks(new Date());
    saveDemoReglementTasks(demo);
    setTasks(demo);
  }

  function clearDemoCalendarData() {
    try {
      localStorage.removeItem(LS_DEMO_REGL_TASKS);
    } catch {
      // ignore
    }
  }

  function reloadManual() {
    const m = loadManualTasks();
    m.sort(compareManual);
    setManual(m);
    setAttIdx(loadIndex());
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reloadBackend();
      if (cancelled) return;
      reloadManual();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backendVisible = useMemo(() => tasks.filter((t) => !isLegacyUrgentBackend(t)), [tasks]);

  const overdue = useMemo(
    () => backendVisible.filter((t) => isOverdueBackend(t, today)).slice(0, 8),
    [backendVisible, today],
  );
  const activeDate = useMemo(() => {
    return calSelectedIso ? parseDateOnly(calSelectedIso) : today;
  }, [calSelectedIso, today]);

  const activeIso = useMemo(() => isoDateOnly(activeDate), [activeDate]);

  const todayTasks = useMemo(
    () =>
      backendVisible
        .filter((t) => !!t.deadline && isoDateOnly(t.deadline!) === activeIso)
        .slice(0, 10),
    [backendVisible, activeIso],
  );

  const manualFiltered = useMemo(() => {
    const q = normalizeManualQuery(mQuery);
    return manual.filter((t) => {
      if (!mShowDone && t.status === "done") return false;
      if (!q) return true;
      const hay = `${t.title} ${t.note || ""} ${t.assignee || ""} ${t.due_date || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [manual, mQuery, mShowDone]);

  const manualUrgent = useMemo(() => manualFiltered.slice(0, 16), [manualFiltered]);

  const tasksByDate = useMemo(() => groupTasksByDateBackend(backendVisible), [backendVisible]);
  const manualByDate = useMemo(() => groupManualByDate(manual), [manual]);
  const grid = useMemo(() => monthGrid(calYear, calMonth), [calYear, calMonth]);

  const procSummary = useMemo(() => {
    const total = proc.length;
    const planned = proc.filter((x) => String(x.status || "").toLowerCase() === "planned").length;
    return { total, planned };
  }, [proc]);

  const monthLabel = useMemo(() => {
    const names = [
      "\u042f\u043d\u0432\u0430\u0440\u044c",
      "\u0424\u0435\u0432\u0440\u0430\u043b\u044c",
      "\u041c\u0430\u0440\u0442",
      "\u0410\u043f\u0440\u0435\u043b\u044c",
      "\u041c\u0430\u0439",
      "\u0418\u044e\u043d\u044c",
      "\u0418\u044e\u043b\u044c",
      "\u0410\u0432\u0433\u0443\u0441\u0442",
      "\u0421\u0435\u043d\u0442\u044f\u0431\u0440\u044c",
      "\u041e\u043a\u0442\u044f\u0431\u0440\u044c",
      "\u041d\u043e\u044f\u0431\u0440\u044c",
      "\u0414\u0435\u043a\u0430\u0431\u0440\u044c",
    ];
    return `${names[calMonth]} ${calYear}`;
  }, [calYear, calMonth]);

  function prevMonth() {
    const m = calMonth - 1;
    if (m < 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth(m);
    }
  }

  function nextMonth() {
    const m = calMonth + 1;
    if (m > 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth(m);
    }
  }

  function createManual() {
    setUiErr(null);
    const title = mTitle.trim();
    if (!title) return;

    const due = mDue.trim();
    const dueNorm = due ? due.slice(0, 10) : null;

    const item: ManualTask = {
      id: makeId(),
      title: title.startsWith("!") ? title : `! ${title}`,
      note: mNote.trim(),
      assignee: mAssignee.trim(),
      due_date: dueNorm,
      status: "todo",
      pinned: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const items = loadManualTasks();
    items.unshift(item);
    saveManualTasks(items);

    setMTitle("");
    setMNote("");
    setMAssignee("");
    setMDue("");
    reloadManual();
  }

  function updateManual(id: string, patch: Partial<ManualTask>) {
    const items = loadManualTasks();
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    items[idx] = { ...items[idx], ...patch, updated_at: nowIso() };
    saveManualTasks(items);
    reloadManual();
  }

  function deleteManual(id: string) {
    const items = loadManualTasks().filter((x) => x.id !== id);
    saveManualTasks(items);

    const a = loadIndex();
    if (a[id]) {
      delete a[id];
      saveIndex(a);
    }
    reloadManual();
  }

  function togglePin(id: string) {
    const items = loadManualTasks();
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const cur = Boolean(items[idx].pinned);
    items[idx] = { ...items[idx], pinned: !cur, updated_at: nowIso() };
    saveManualTasks(items);
    reloadManual();
  }

  function triggerFile(taskId: string) {
    const el = fileInputsRef.current[taskId];
    if (el) el.click();
  }

  async function attachFile(taskId: string, file: File) {
    setUiErr(null);

    if (file.size > MAX_FILE_BYTES) {
      setUiErr("\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0439 (max 2MB).");
      return;
    }

    try {
      const { mime, dataUrl } = await fileToDataUrl(file);
      const idx = loadIndex();
      const arr = Array.isArray(idx[taskId]) ? idx[taskId] : [];
      arr.unshift({ name: file.name, mime, data_url: dataUrl, added_at: nowIso() });
      idx[taskId] = arr.slice(0, 6);
      saveIndex(idx);
      setAttIdx(idx);
    } catch (e: any) {
      setUiErr(String(e?.message || e || "error"));
    }
  }

  function deleteAttachment(taskId: string, addedAt: string) {
    const idx = loadIndex();
    const arr = Array.isArray(idx[taskId]) ? idx[taskId] : [];
    idx[taskId] = arr.filter((x) => String(x.added_at) !== String(addedAt));
    saveIndex(idx);
    setAttIdx(idx);
  }

  function dayCount(key: string): number {
    const a = (tasksByDate[key] || []).length;
    const b = (manualByDate[key] || []).length;
    return a + b;
  }

  return (
    <div className="daydash">
      <div className="daydash-top">
        <div className="daydash-title">
          <div className="daydash-h1">{"\u0413\u043b\u0430\u0432\u043d\u044b\u0439 \u0434\u0435\u043d\u044c"}</div>
          <div className="daydash-sub">
            {isoDateLocal(today)}{" "}
            <span className="daydash-muted">
              {procSummary.total > 0
                ? `\u2022 \u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b: ${procSummary.total} \u2022 \u041f\u043b\u0430\u043d: ${procSummary.planned}`
                : "\u2022 \u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b: 0"}
            </span>
          </div>
        </div>

        <div className="daydash-counters">
          <div className={"dd-kpi " + (overdue.length > 0 ? "dd-kpi-bad" : "")}>
            <div className="dd-kpi-num">{overdue.length}</div>
            <div className="dd-kpi-lbl">{"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e"}</div>
          </div>
          <div className="dd-kpi">
            <div className="dd-kpi-num">{todayTasks.length}</div>
            <div className="dd-kpi-lbl">{"\u041d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}</div>
          </div>
          <div className={"dd-kpi " + (manualUrgent.length > 0 ? "dd-kpi-warn" : "")}>
            <div className="dd-kpi-num">{manualUrgent.length}</div>
            <div className="dd-kpi-lbl">{"\u0421\u0440\u043e\u0447\u043d\u043e \u0432\u043d\u0435 \u0440\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442\u0430"}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="daydash-panel">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026"}</div>
      ) : err ? (
        <div className="daydash-panel daydash-error">
          <div className="daydash-error-title">{"\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438"}</div>
          <div className="daydash-mono">{err}</div>
        </div>
      ) : (
        <>
          <div className={"daydash-panel daydash-urgent-top " + (manualUrgent.length > 0 ? "daydash-panel-warn" : "")}>
            <div className="daydash-panel-head">
              <div className="daydash-panel-title">{"\u0421\u0440\u043e\u0447\u043d\u043e \u0432\u043d\u0435 \u0440\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442\u0430"}</div>
              <div className="dd-right-actions">
                <button className="dd-btn dd-btn-small" type="button" onClick={reloadManual}>
                  {"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
                </button>
              </div>
            </div>

            <div className="dd-urgent-create dd-urgent-create-v3">
              <input
                className="dd-input dd-input-title"
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (mTitle.trim()) createManual();
                  }
                }}
                placeholder={"\u041d\u043e\u0432\u0430\u044f \u0441\u0440\u043e\u0447\u043d\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430\u2026"}
              />
              <input
                className="dd-input"
                value={mAssignee}
                onChange={(e) => setMAssignee(e.target.value)}
                placeholder={"\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 (optional)"}
              />
              <input
                className="dd-input dd-input-date"
                type="date"
                value={mDue}
                onChange={(e) => setMDue(e.target.value)}
              />
              <button className="dd-btn dd-btn-primary" onClick={createManual} disabled={!mTitle.trim()} type="button">
                {"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c"}
              </button>

              <textarea
                className="dd-textarea"
                value={mNote}
                onChange={(e) => setMNote(e.target.value)}
                placeholder={"\u041a\u043e\u0440\u043e\u0442\u043a\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430 (optional)\u2026"}
              />
            </div>

            <div className="dd-manual-tools">
              <input
                className="dd-input dd-input-search"
                value={mQuery}
                onChange={(e) => setMQuery(e.target.value)}
                placeholder={"\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u0441\u0440\u043e\u0447\u043d\u044b\u043c\u2026"}
              />
              <label className="dd-check">
                <input
                  type="checkbox"
                  checked={mShowDone}
                  onChange={(e) => setMShowDone(Boolean(e.target.checked))}
                />
                <span>{"\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0435"}</span>
              </label>
              <button
                className="dd-btn dd-btn-small"
                type="button"
                onClick={() => {
                  setMQuery("");
                  setMShowDone(false);
                }}
              >
                {"\u0421\u0431\u0440\u043e\u0441"}
              </button>
            </div>

            {uiErr ? (
              <div className="dd-inline-error">
                <div className="daydash-mono">{uiErr}</div>
              </div>
            ) : null}

            {manualUrgent.length === 0 ? (
              <div className="daydash-empty">{"\u041d\u0435\u0442 \u0441\u0440\u043e\u0447\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u0447."}</div>
            ) : (
              <div className="dd-urgent-grid dd-urgent-grid-v2">
                {manualUrgent.map((t) => {
                  const atts = attIdx[t.id] || [];
                  return (
                    <div key={t.id} className={"dd-urgent-card " + (t.status === "done" ? "dd-urgent-done" : "")}>
                      <div className="dd-urgent-head">
                        <button
                          className={"dd-pin " + (t.pinned ? "dd-pin-on" : "")}
                          type="button"
                          onClick={() => togglePin(t.id)}
                          title="pin"
                        >
                          {"\u2605"}
                        </button>
                        <div className="dd-urgent-title">{t.title}</div>
                      </div>

                      <div className="dd-urgent-meta">
                        <span className="daydash-pill">{t.assignee ? t.assignee : "\u041e\u0431\u0449\u0430\u044f"}</span>
                        <span className={"daydash-pill " + (t.status === "todo" ? "daydash-pill-warn" : "")}>
                          {statusLabel(t.status)}
                        </span>
                        <span className="daydash-pill">{t.due_date ? t.due_date : "\u0411\u0435\u0437 \u0441\u0440\u043e\u043a\u0430"}</span>
                      </div>

                      {t.note ? <div className="dd-note">{t.note}</div> : null}

                      <div className="dd-actions">
                        <button className="dd-btn dd-btn-small" type="button" onClick={() => updateManual(t.id, { status: "todo" })}>
                          {"\u0422\u043e\u0434\u043e"}
                        </button>
                        <button className="dd-btn dd-btn-small" type="button" onClick={() => updateManual(t.id, { status: "in_progress" })}>
                          {"\u0412 \u0440\u0430\u0431\u043e\u0442\u0435"}
                        </button>
                        <button className="dd-btn dd-btn-small" type="button" onClick={() => updateManual(t.id, { status: "done" })}>
                          {"\u0413\u043e\u0442\u043e\u0432\u043e"}
                        </button>
                        <button className="dd-btn dd-btn-small" type="button" onClick={() => triggerFile(t.id)}>
                          {"\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u0438\u0442\u044c"}
                        </button>
                        <button className="dd-btn dd-btn-small dd-btn-danger" type="button" onClick={() => deleteManual(t.id)}>
                          {"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}
                        </button>

                        <input
                          ref={(el) => {
                            fileInputsRef.current[t.id] = el;
                          }}
                          className="dd-hidden"
                          type="file"
                          onChange={(e) => {
                            const f = e.target.files && e.target.files[0];
                            if (!f) return;
                            e.target.value = "";
                            void attachFile(t.id, f);
                          }}
                        />
                      </div>

                      {atts.length > 0 ? (
                        <div className="dd-attach-list">
                          {atts.slice(0, 6).map((a) => (
                            <div key={a.added_at + a.name} className="dd-attach-row">
                              <a className="dd-attach" href={a.data_url} download={a.name}>
                                {a.name}
                              </a>
                              <button
                                className="dd-attach-del"
                                type="button"
                                onClick={() => deleteAttachment(t.id, a.added_at)}
                                title="remove"
                              >
                                {"\u00d7"}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="dd-urgent-note">
              {"\u0421\u0440\u043e\u0447\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0445\u0440\u0430\u043d\u044f\u0442\u0441\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e \u043e\u0442 \u0440\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442\u043d\u044b\u0445 (localStorage, MVP)."}
            </div>
          </div>

          <div className="daydash-main">
            <div className="daydash-left">
              <div className="daydash-panel">
                <div className="daydash-panel-head">
                  <div className="daydash-panel-title">{calSelectedIso ? "\u041d\u0430 \u0434\u0430\u0442\u0443: " + formatDateRu(activeDate) : "\u0421\u0435\u0433\u043e\u0434\u043d\u044f"}</div>
                  <a className="dd-link" href="/tasks">{"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u043f\u0438\u0441\u043e\u043a"}</a>
                </div>

                {todayTasks.length === 0 ? (
                  <div className="daydash-empty">{"\u041d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0442 \u0437\u0430\u0434\u0430\u0447."}</div>
                ) : (
                  <ul className="daydash-list">
                    {todayTasks.map((t) => (
                      <li key={t.id} className="daydash-item">
                        <div className="daydash-item-title">{t.title}</div>
                        <div className="daydash-item-meta">
                          <span className="daydash-pill">{t.client_label || t.client_code || "\u0411\u0435\u0437 \u043a\u043b\u0438\u0435\u043d\u0442\u0430"}</span>
                          <span className="daydash-pill">{t.deadline ? String(t.deadline).slice(0, 10) : "\u0411\u0435\u0437 \u0434\u0430\u0442\u044b"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={"daydash-panel " + (overdue.length > 0 ? "daydash-panel-bad" : "")}>
                <div className="daydash-panel-head">
                  <div className="daydash-panel-title">{"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043d\u044b\u0435"}</div>
                  <a className="dd-link" href="/tasks">{"\u0412\u0441\u0435 \u0437\u0430\u0434\u0430\u0447\u0438"}</a>
                </div>

                {overdue.length === 0 ? (
                  <div className="daydash-empty">{"\u041d\u0435\u0442 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043a."}</div>
                ) : (
                  <ul className="daydash-list">
                    {overdue.map((t) => (
                      <li key={t.id} className="daydash-item">
                        <div className="daydash-item-title">{t.title}</div>
                        <div className="daydash-item-meta">
                          <span className="daydash-pill">{t.client_label || t.client_code || "\u0411\u0435\u0437 \u043a\u043b\u0438\u0435\u043d\u0442\u0430"}</span>
                          <span className="daydash-pill daydash-pill-bad">{t.deadline ? String(t.deadline).slice(0, 10) : "\u0411\u0435\u0437 \u0434\u0430\u0442\u044b"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="daydash-right">
              <div className="daydash-panel">
                <div className="daydash-panel-head">
                  <div className="daydash-panel-title">{"\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c"}</div>
                  <div className="daydash-cal-ctrl">
                    <button className="dd-btn" onClick={prevMonth} type="button">
                      {"\u2039"}
                    </button>
                    <div className="daydash-cal-month">{monthLabel}</div>
                  <button
                    type="button"
                    className="daydash-cal-reset"
                    onClick={() => setCalSelectedIso(null)}
                    disabled={!calSelectedIso}
                  >
                    {"\u0421\u0431\u0440\u043e\u0441"}
                  </button>
                    <button className="dd-btn" onClick={nextMonth} type="button">
                      {"\u203a"}
                    </button>
                  </div>
                </div>

                <div className="daydash-cal">
                  <div className="daydash-cal-dow">{"\u041f\u043d"}</div>
                  <div className="daydash-cal-dow">{"\u0412\u0442"}</div>
                  <div className="daydash-cal-dow">{"\u0421\u0440"}</div>
                  <div className="daydash-cal-dow">{"\u0427\u0442"}</div>
                  <div className="daydash-cal-dow">{"\u041f\u0442"}</div>
                  <div className="daydash-cal-dow daydash-cal-dow-weekend">{"\u0421\u0431"}</div>
                  <div className="daydash-cal-dow daydash-cal-dow-weekend">{"\u0412\u0441"}</div>

                  {grid.map((d) => {
                    const inMonth = d.getMonth() === calMonth;
                    const key = isoDateLocal(d);
                    const count = dayCount(key);
                    const isWknd = d.getDay() === 0 || d.getDay() === 6;
                    const isNow = isoDateLocal(d) === isoDateLocal(today);

                    const cls =
                      "daydash-cal-cell" +
                      (inMonth ? "" : " daydash-cal-out") +
                      (isWknd ? " daydash-cal-weekend" : "") +
                      (isNow ? " daydash-cal-today" : "") +
                      (count > 0 ? " daydash-cal-has" : "");

                    return (
                      <button
                        type="button"
                        className={cls + (calSelectedIso === key ? " daydash-cal-selected" : "")}
                        key={key}
                        onClick={() => setCalSelectedIso(key)}
                      >
                        <div className="daydash-cal-num">{d.getDate()}</div>
                        {count > 0 ? <div className="daydash-cal-dot">{count}</div> : null}
                      </button>
                    );
                  })}
                </div>

                <div className="daydash-hint">
                  <span className="daydash-hint-dot" />{" "}
                  {"\u0414\u043d\u0438 \u0441 \u0437\u0430\u0434\u0430\u0447\u0430\u043c\u0438 \u043f\u043e\u043c\u0435\u0447\u0435\u043d\u044b \u0447\u0438\u0441\u043b\u043e\u043c (manual + reglement)."}
                </div>
                <div className="daydash-demo-row">
                  <button type="button" className="daydash-demo-btn" onClick={generateDemoCalendarData}>
                    {"\u0421\u043e\u0437\u0434\u0430\u0442\u044c demo \u0437\u0430\u0434\u0430\u0447\u0438 (local)"}
                  </button>
                  <button
                    type="button"
                    className="daydash-demo-btn"
                    onClick={() => {
                      clearDemoCalendarData();
                      setTasks([]);
                    }}
                  >
                    {"\u0423\u0431\u0440\u0430\u0442\u044c demo"}
                  </button>
                </div>
              </div>
              <div className="daydash-panel">
                <div className="daydash-panel-head">
                  <div className="daydash-panel-title">{"\u041a\u043b\u0438\u0435\u043d\u0442\u044b"}</div>
                  <a className="dd-link" href="/client-profile">{"\u041e\u0442\u043a\u0440\u044b\u0442\u044c"}</a>
                </div>

                <input
                  className="dd-input dd-input-search"
                  value={clientQ}
                  onChange={(e) => setClientQ(e.target.value)}
                  placeholder={"\u041f\u043e\u0438\u0441\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u2026"}
                />

                {clients.length === 0 ? (
                  <div className="daydash-empty">{"\u041a\u043b\u0438\u0435\u043d\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."}</div>
                ) : (
                  <ul className="daydash-list daydash-list-compact">
                    {clients
                      .filter((c) => {
                        const qq = clientQ.trim().toLowerCase();
                        if (!qq) return true;
                        const hay = `${c.name || ""} ${c.client_code || ""}`.toLowerCase();
                        return hay.includes(qq);
                      })
                      .slice(0, 12)
                      .map((c) => (
                        <li key={c.id} className="daydash-item daydash-item-compact">
                          <div className="daydash-item-title">{c.name}</div>
                          <div className="daydash-item-meta">
                            <span className="daydash-pill">{c.client_code || c.id}</span>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="daydash-panel">
                <SharedDocsBlock />
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
