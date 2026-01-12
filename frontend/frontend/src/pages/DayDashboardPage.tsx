import { useEffect, useMemo, useRef, useState } from "react";
import * as React from "react";
import { useSidePanel } from "../components/ux/SidePanelEngine";
import StorageWorkspace from "../components/storage/StorageWorkspace";
import { apiGetJson } from "../api";
import "../ux/dayDashboard.css";

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
  const { openPanel, closePanel } = useSidePanel();
  const fmtDateIsoLike = (v?: string) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [clientQ, setClientQ] = useState<string>("");
  const [proc, setProc] = useState<ProcessInstance[]>([]);
  const [manual, setManual] = useState<ManualTask[]>(() => loadManualTasks());

  
  const [selected, setSelected] = useState<{ kind: "backend" | "manual"; id: string } | null>(null);
const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteOpen, setNoteOpen] = useState<boolean>(false);

  const notesKey = "erpv2.day.notes.v1";
  const doneKey = "erpv2.day.doneLocal.v1";

  const loadJsonMap = (key: string): Record<string, string> => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj as Record<string, string>;
      return {};
    } catch {
      return {};
    }
  };

  const loadBoolMap = (key: string): Record<string, boolean> => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj as Record<string, boolean>;
      return {};
    } catch {
      return {};
    }
  };

  const saveMap = (key: string, obj: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
    } catch {
      // ignore
    }
  };

  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => loadJsonMap(notesKey));
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(() => loadBoolMap(doneKey));

  const keyFor = (kind: "backend" | "manual", id: string) => `${kind}:${id}`;

  const getNote = (kind: "backend" | "manual", id: string) => notesMap[keyFor(kind, id)] || "";
  const isDoneLocal = (kind: "backend" | "manual", id: string) => !!doneMap[keyFor(kind, id)];

  const setDoneLocal = (kind: "backend" | "manual", id: string, v: boolean) => {
    const k = keyFor(kind, id);
    const next = { ...doneMap, [k]: v };
    setDoneMap(next);
    saveMap(doneKey, next);
  };

  const openNote = (kind: "backend" | "manual", id: string) => {
    setSelected({ kind, id });
    setNoteDraft(getNote(kind, id));
    setNoteOpen(true);
  };

  const saveNote = () => {
    if (!selected) return;
    const k = keyFor(selected.kind, selected.id);
    const next = { ...notesMap, [k]: noteDraft };
    setNotesMap(next);
    saveMap(notesKey, next);
    setNoteOpen(false);
  };
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
    () => backendVisible.filter((t) => isOverdueBackend(t, today) && !isDoneLocal("backend", t.id)).slice(0, 8),
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

  

  React.useEffect(() => {
    if (!selected) {
      closePanel();
      return;
    }

    if (selected.kind === "backend") {
      const t = backendVisible.find((x) => x.id === selected.id);
      if (!t) {
        closePanel();
        return;
      }

      const due = t.deadline ? fmtDateIsoLike(String(t.deadline)) : "";
      const client = t.client_label || t.client_code || "";

      openPanel({
        title: "\u0417\u0430\u0434\u0430\u0447\u0430",
        subtitle: client || "",
        actions: (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="erp-btn erp-btn-primary" type="button" onClick={() => setDoneLocal("backend", t.id, true)}>
              {"\u0413\u043e\u0442\u043e\u0432\u043e"}
            </button>
            <button className="erp-btn" type="button" onClick={() => openNote("backend", t.id)}>
              {"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"}
            </button>
            <button className="erp-btn" type="button" onClick={() => (window.location.href = "/tasks")}>
              {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0432 \u0417\u0430\u0434\u0430\u0447\u0430\u0445"}
            </button>
          </div>
        ),
        sections: [
          {
            title: "\u041e\u0431\u0437\u043e\u0440",
            content: (
              <div className="erp-kv">
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Client"}</div>
                  <div className="erp-kv-v">{client || "\u2014"}</div>
                </div>
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Due"}</div>
                  <div className="erp-kv-v">{due || "\u2014"}</div>
                </div>
                <div className="erp-kv-row">
                  <div className="erp-kv-k">{"Status"}</div>
                  <div className="erp-kv-v">{String(t.status || "") || "\u2014"}</div>
                </div>
              </div>
            ),
          },
          {
            title: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 (local)",
            content: <div className="erp-muted">{getNote("backend", t.id) || "\u2014"}</div>,
          },
        ],
        widthPx: 560,
        onClose: () => setSelected(null),
      });
      return;
    }

    const m = manualUrgent.find((x) => x.id === selected.id) || manual.find((x) => x.id === selected.id);
    if (!m) {
      closePanel();
      return;
    }

    openPanel({
      title: "\u0421\u0440\u043e\u0447\u043d\u0430\u044f \u0437\u0430\u043c\u0435\u0442\u043a\u0430",
      subtitle: m.assignee ? String(m.assignee) : "",
      actions: (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="erp-btn erp-btn-primary" type="button" onClick={() => setDoneLocal("manual", m.id, true)}>
            {"\u0413\u043e\u0442\u043e\u0432\u043e"}
          </button>
          <button className="erp-btn" type="button" onClick={() => openNote("manual", m.id)}>
            {"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"}
          </button>
        </div>
      ),
      sections: [
        {
          title: "\u041e\u0431\u0437\u043e\u0440",
          content: (
            <div className="erp-kv">
              <div className="erp-kv-row">
                <div className="erp-kv-k">{"Title"}</div>
                <div className="erp-kv-v">{String(m.title || "")}</div>
              </div>
              <div className="erp-kv-row">
                <div className="erp-kv-k">{"Due"}</div>
                <div className="erp-kv-v">{m.due_date ? fmtDateIsoLike(String(m.due_date)) : "\u2014"}</div>
              </div>
              <div className="erp-kv-row">
                <div className="erp-kv-k">{"Assignee"}</div>
                <div className="erp-kv-v">{m.assignee ? String(m.assignee) : "\u2014"}</div>
              </div>
            </div>
          ),
        },
        {
          title: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 (local)",
          content: <div className="erp-muted">{getNote("manual", m.id) || "\u2014"}</div>,
        },
      ],
      widthPx: 560,
      onClose: () => setSelected(null),
    });
  }, [selected, openPanel, closePanel, backendVisible, manualUrgent, manual, noteDraft, doneMap, notesMap]);
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
    <div className="ddq">
      <div className="ddq-top">
        <div className="ddq-title">
          <div className="ddq-h1">{"\u041e\u0447\u0435\u0440\u0435\u0434\u044c"}</div>
          <div className="ddq-sub">
            {isoDateLocal(today)}
            <span className="ddq-muted">
              {procSummary.total > 0
                ? `\u2022 \u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b: ${procSummary.total} \u2022 \u041f\u043b\u0430\u043d: ${procSummary.planned}`
                : "\u2022 \u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b: 0"}
            </span>
          </div>
        </div>

        <div className="ddq-actions">
          <button className="ddq-btn" type="button" onClick={() => (window.location.href = "/control")}>
            {"\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c"}
          </button>
          <button className="ddq-btn" type="button" onClick={() => (window.location.href = "/tasks")}>
            {"\u0417\u0430\u0434\u0430\u0447\u0438"}
          </button>
          <button className="ddq-btn" type="button" onClick={() => (window.location.href = "/client-profile")}>
            {"\u041a\u043b\u0438\u0435\u043d\u0442\u044b"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ddq-card">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026"}</div>
      ) : err ? (
        <div className="ddq-card ddq-card-danger">
          <div className="ddq-card-title">{"\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438"}</div>
          <div className="ddq-mono">{err}</div>
        </div>
      ) : (
        <>
          {(() => {
            const nowQueue = backendVisible
              .filter((t) => isOverdueBackend(t, today) && !isDoneLocal("backend", t.id))
              .sort((a, b) => (Date.parse(a.deadline || "") || 0) - (Date.parse(b.deadline || "") || 0));

            const todayQueue = backendVisible
              .filter((t) => !isOverdueBackend(t, today) && isTodayBackend(t, today) && !isDoneLocal("backend", t.id))
              .sort((a, b) => (Date.parse(a.deadline || "") || 0) - (Date.parse(b.deadline || "") || 0));

            const laterQueue = backendVisible
              .filter((t) => !isOverdueBackend(t, today) && !isTodayBackend(t, today) && !isDoneLocal("backend", t.id))
              .sort((a, b) => (Date.parse(a.deadline || "") || 0) - (Date.parse(b.deadline || "") || 0));

            const renderRow = (t: Task, kind: "overdue" | "soon" | "ok") => {
              const due = t.deadline ? fmtDateIsoLike(t.deadline) : "";
              const client = t.client_label || t.client_code || "";
              return (
                <div key={t.id} className={"ddq-row ddq-row-" + kind} role="button" tabIndex={0} onClick={() => setSelected({ kind: "backend", id: t.id })} onKeyDown={(e) => { if (e.key === "Enter") setSelected({ kind: "backend", id: t.id }); }}>
                  <div className="ddq-row-bar" />
                  <div className="ddq-row-main">
                    <div className="ddq-row-title">{t.title}</div>
                    <div className="ddq-row-meta">
                      {client ? <span className="ddq-pill">{client}</span> : null}
                      {t.client_code ? <span className="ddq-pill ddq-pill-muted">{t.client_code}</span> : null}
                      {due ? <span className="ddq-pill ddq-pill-date">{due}</span> : null}
                    </div>
                  </div>
                  <div className="ddq-row-right">
                    <div className="ddq-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="ddq-act ddq-act-primary" type="button" onClick={() => setDoneLocal("backend", t.id, true)}>
                        {"\u0413\u043e\u0442\u043e\u0432\u043e"}
                      </button>
                      <button className="ddq-act" type="button" onClick={() => openNote("backend", t.id)}>
                        {"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"}
                      </button>
                    </div>
                    <span className={"ddq-status ddq-status-" + kind}>
                      {kind === "overdue"
                        ? "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e"
                        : kind === "soon"
                          ? "\u0421\u0435\u0433\u043e\u0434\u043d\u044f"
                          : "\u0412 \u0441\u0440\u043e\u043a"}
                    </span>
                  </div>
                </div>
              );
            };

            return (
              <div className="ddq-stack">
                
                <section className="ddq-section ddq-section-urgent">
                  <div className="ddq-section-head ddq-section-head-urgent">
                    <div className="ddq-section-title">{"\u0421\u0440\u043e\u0447\u043d\u043e"}</div>
                    <div className="ddq-section-sub">
                      {"\u0412\u043d\u0435 \u0440\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442\u0430"}: {manualUrgent.length}
                    </div>
                  </div>

                  {manualUrgent.length === 0 ? (
                    <div className="ddq-empty">
                      {"\u041d\u0435\u0442 \u0441\u0440\u043e\u0447\u043d\u044b\u0445 \u0432\u043d\u0435\u043f\u043b\u0430\u043d\u043e\u0432\u044b\u0445 \u0437\u0430\u0434\u0430\u0447."}
                    </div>
                  ) : (
                    <div className="ddq-list">
                      {manualUrgent.filter((m) => !isDoneLocal("manual", m.id)).slice(0, 12).map((m) => (
                        <div key={m.id} className="ddq-row ddq-row-urgent" role="button" tabIndex={0} onClick={() => setSelected({ kind: "manual", id: m.id })} onKeyDown={(e) => { if (e.key === "Enter") setSelected({ kind: "manual", id: m.id }); }}>
                          <div className="ddq-row-bar" />
                          <div className="ddq-row-main">
                            <div className="ddq-row-title">{m.title}</div>
                            <div className="ddq-row-meta">
                              {m.due_date ? <span className="ddq-pill ddq-pill-date">{fmtDateIsoLike(m.due_date)}</span> : null}
                              {m.assignee ? <span className="ddq-pill ddq-pill-muted">{m.assignee}</span> : null}
                            </div>
                          </div>
                          <div className="ddq-row-right">
                            <div className="ddq-row-actions" onClick={(e) => e.stopPropagation()}>
                              <button className="ddq-act ddq-act-primary" type="button" onClick={() => setDoneLocal("manual", m.id, true)}>
                                {"\u0413\u043e\u0442\u043e\u0432\u043e"}
                              </button>
                              <button className="ddq-act" type="button" onClick={() => openNote("manual", m.id)}>
                                {"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"}
                              </button>
                            </div>
                            <span className="ddq-status ddq-status-urgent">{"\u0421\u0440\u043e\u0447\u043d\u043e"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

<section className="ddq-section">
                  <div className="ddq-section-head">
                    <div className="ddq-section-title">{"\u0421\u0435\u0439\u0447\u0430\u0441"}</div>
                    <div className="ddq-section-sub">
                      {"\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e"}: {nowQueue.length}
                    </div>
                  </div>

                  {nowQueue.length === 0 ? (
                    <div className="ddq-empty">
                      {"\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u0433\u043e\u0440\u0438\u0442. \u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0441\u043f\u043e\u043a\u043e\u0439\u043d\u0430."}
                    </div>
                  ) : (
                    <div className="ddq-list">{nowQueue.map((t) => renderRow(t, "overdue"))}</div>
                  )}
                </section>

                <section className="ddq-section">
                  <div className="ddq-section-head">
                    <div className="ddq-section-title">{"\u0421\u0435\u0433\u043e\u0434\u043d\u044f"}</div>
                    <div className="ddq-section-sub">
                      {"\u0421\u0440\u043e\u043a \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}: {todayQueue.length}
                    </div>
                  </div>

                  {todayQueue.length === 0 ? (
                    <div className="ddq-empty">
                      {"\u041d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435\u0442 \u043e\u0441\u0442\u0440\u044b\u0445 \u0441\u0440\u043e\u043a\u043e\u0432."}
                    </div>
                  ) : (
                    <div className="ddq-list">{todayQueue.map((t) => renderRow(t, "soon"))}</div>
                  )}
                </section>
<details className="ddq-details">
                  <summary className="ddq-details-sum">{"\u041e\u0431\u0449\u0438\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b"}</summary>
                  <div className="ddq-card">
                    <StorageWorkspace defaultView="documents" embedded={true} />
                  </div>
                </details>
              </div>
            );
          })()}
        </>
      )}
    

      {/* Note modal */}
      {noteOpen ? (
        <div className="ddq-modal" role="dialog" aria-modal="true">
          <div className="ddq-modal-card">
            <div className="ddq-modal-head">
              <div className="ddq-modal-title">{"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 (\u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e)"}</div>
              <button className="ddq-icon" type="button" onClick={() => setNoteOpen(false)}>
                {"\u2715"}
              </button>
            </div>
            <textarea className="ddq-textarea" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
            <div className="ddq-modal-btns">
              <button className="ddq-act" type="button" onClick={() => setNoteOpen(false)}>
                {"\u041e\u0442\u043c\u0435\u043d\u0430"}
              </button>
              <button className="ddq-act ddq-act-primary" type="button" onClick={saveNote}>
                {"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
</div>
  );

}