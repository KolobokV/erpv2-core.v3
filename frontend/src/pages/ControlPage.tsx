import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGetJson } from "../api";

import "../ux/controlSidePanel.css";
type Task = {
  id: string;
  client_code?: string;
  client_label?: string;
  title: string;
  status?: string;
  priority?: string;
  deadline?: string;
  description?: string;
  [k: string]: any;
};

type ControlRow = {
  id: string;
  client: string;
  label: string;
  planned: string; // ISO or display
  kind: "overdue" | "soon" | "ok";
  source: "task" | "demo";
  raw?: any;
};

type PeriodKey = "today" | "7" | "14" | "30";
type StatusKey = "all" | "overdue" | "soon" | "ok";

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function ui(key: string): string {
  const dict: Record<string, string> = {
    control: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c",
    subtitle: "\u041e\u0434\u0438\u043d \u0441\u043f\u0438\u0441\u043e\u043a. \u041e\u0434\u043d\u043e \u043e\u043a\u043d\u043e. \u041e\u0434\u0438\u043d \u0444\u043e\u043a\u0443\u0441.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    period: "\u041f\u0435\u0440\u0438\u043e\u0434",
    today: "\u0421\u0435\u0433\u043e\u0434\u043d\u044f",
    d7: "7 \u0434\u043d\u0435\u0439",
    d14: "14 \u0434\u043d\u0435\u0439",
    d30: "30 \u0434\u043d\u0435\u0439",
    client: "\u041a\u043b\u0438\u0435\u043d\u0442",
    status: "\u0421\u0442\u0430\u0442\u0443\u0441",
    search: "\u041f\u043e\u0438\u0441\u043a",
    all: "\u0412\u0441\u0435",
    overdue: "\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e",
    soon: "\u0421\u043a\u043e\u0440\u043e",
    ok: "\u0412 \u0441\u0440\u043e\u043a",
    markDone: "\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e",
    comment: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439",
    emptyTitle: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439 \u0434\u043b\u044f \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f",
    emptyText:
      "\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0441\u043e\u0431\u044b\u0442\u0438\u044f \u0438 \u0437\u0430\u0434\u0430\u0447\u0438, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u043d\u0443\u0436\u043d\u043e \u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043d\u0430 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0435.",
    emptyHint:
      "\u041f\u043e\u043a\u0430 \u043c\u044b \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u0434\u0435\u043c\u043e-\u0434\u0430\u043d\u043d\u044b\u0435, \u0447\u0442\u043e\u0431\u044b \u044d\u043a\u0440\u0430\u043d \u043d\u0435 \u0431\u044b\u043b \u043f\u0443\u0441\u0442\u044b\u043c.",
    panelTitle: "\u0414\u0435\u0442\u0430\u043b\u0438",
    panelHistory: "\u0418\u0441\u0442\u043e\u0440\u0438\u044f",
    panelComments: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438",
    close: "\u0417\u0430\u043a\u0440\u044b\u0442\u044c",
    add: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c",
    placeholderSearch: "\u041a\u043b\u0438\u0435\u043d\u0442 \u0438\u043b\u0438 \u0441\u043e\u0431\u044b\u0442\u0438\u0435...",
    placeholderComment: "\u041a\u0440\u0430\u0442\u043a\u043e: \u0447\u0442\u043e \u0441\u0434\u0435\u043b\u0430\u043d\u043e \u0438\u043b\u0438 \u0447\u0442\u043e \u043d\u0443\u0436\u043d\u043e",
  };
  return dict[key] || key;
}

function parseIsoDate(v?: string): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  return t;
}

function fmtDate(v?: string): string {
  if (!v) return "\u2014";
  const t = parseIsoDate(v);
  if (!t) return s(v);
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}`;
}

function statusKindFromPlanned(iso?: string): "overdue" | "soon" | "ok" {
  const t = parseIsoDate(iso);
  if (!t) return "ok";
  const now = Date.now();
  if (t < now) return "overdue";
  const soonMs = 72 * 60 * 60 * 1000;
  if (t - now <= soonMs) return "soon";
  return "ok";
}

function badgeText(kind: "overdue" | "soon" | "ok"): string {
  if (kind === "overdue") return ui("overdue");
  if (kind === "soon") return ui("soon");
  return ui("ok");
}

function badgeClass(kind: "overdue" | "soon" | "ok"): string {
  if (kind === "overdue") return "erp-badge erp-badge--bad";
  if (kind === "soon") return "erp-badge erp-badge--warn";
  return "erp-badge erp-badge--ok";
}

function loadLocalMap(key: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    return obj;
  } catch {
    return {};
  }
}

function saveLocalMap(key: string, obj: Record<string, any>) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {}
}

function uniq(arr: string[]): string[] {
  const sset = new Set<string>();
  for (const x of arr) {
    const t = x.trim();
    if (t) sset.add(t);
  }
  return Array.from(sset.values()).sort((a, b) => a.localeCompare(b));
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

function normalizeTasks(data: any): Task[] {
  const arr = (data?.tasks ?? data?.items ?? data) as any;
  if (!Array.isArray(arr)) return [];
  return arr as Task[];
}

function buildRowsFromTasks(tasks: Task[]): ControlRow[] {
  return tasks.map((t) => {
    const client = s(t.client_code || t.client_label || "unknown");
    const planned = s(t.deadline || "");
    const kind = statusKindFromPlanned(planned);
    return {
      id: "task:" + s(t.id),
      client,
      label: s(t.title || "task"),
      planned,
      kind,
      source: "task",
      raw: t,
    };
  });
}

function demoRows(nowIso: string): ControlRow[] {
  return [
    {
      id: "demo:1",
      client: "demo_client_a",
      label: "VAT declaration",
      planned: nowIso,
      kind: "soon",
      source: "demo",
    },
    {
      id: "demo:2",
      client: "demo_client_b",
      label: "Payroll processing",
      planned: nowIso,
      kind: "ok",
      source: "demo",
    },
    {
      id: "demo:3",
      client: "demo_client_c",
      label: "Bank statement request",
      planned: "2025-01-01",
      kind: "overdue",
      source: "demo",
    },
  ];
}

function clampPeriodToDays(k: PeriodKey): number {
  if (k === "today") return 1;
  return Number(k);
}

function inPeriod(iso: string | undefined, days: number): boolean {
  const t = parseIsoDate(iso);
  if (!t) return true;
  const now = Date.now();
  const max = now + days * 24 * 60 * 60 * 1000;
  return t >= now - 24 * 60 * 60 * 1000 && t <= max;
}

export default function ControlPage() {
  const { openPanel, closePanel } = useSidePanel();
  const [rows, setRows] = useState<ControlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("14");
  const [client, setClient] = useState<string>("all");
  const [status, setStatus] = useState<StatusKey>("all");
  const [q, setQ] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const onceRef = useRef(false);

  const doneMap = useMemo(() => loadLocalMap("erpv2_control_done_v1"), []);
  const commentsMap = useMemo(() => loadLocalMap("erpv2_control_comments_v1"), []);
  const [localTick, setLocalTick] = useState(0);

  const clients = useMemo(() => {
    const arr = uniq(rows.map((r) => r.client));
    return arr;
  }, [rows]);

  const filtered = useMemo(() => {
    const days = clampPeriodToDays(period);
    const qq = q.trim().toLowerCase();
    return rows
      .filter((r) => (client === "all" ? true : r.client === client))
      .filter((r) => (status === "all" ? true : r.kind === status))
      .filter((r) => inPeriod(r.planned, days))
      .filter((r) => {
        if (!qq) return true;
        const hay = (r.client + " " + r.label).toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => {
        const ta = parseIsoDate(a.planned) || 0;
        const tb = parseIsoDate(b.planned) || 0;
        if (ta !== tb) return ta - tb;
        return a.client.localeCompare(b.client);
      });
  }, [rows, period, client, status, q]);

  const anyEmpty = useMemo(() => rows.length === 0, [rows]);

  function isDone(rowId: string): boolean {
    const m = loadLocalMap("erpv2_control_done_v1");
    return Boolean(m[rowId]);
  }

  function markDone(rowId: string) {
    const m = loadLocalMap("erpv2_control_done_v1");
    m[rowId] = { at: new Date().toISOString() };
    saveLocalMap("erpv2_control_done_v1", m);
    setLocalTick((x) => x + 1);
  }

  function addComment(rowId: string, text: string) {
    const m = loadLocalMap("erpv2_control_comments_v1");
    const arr = Array.isArray(m[rowId]) ? (m[rowId] as any[]) : [];
    arr.unshift({ at: new Date().toISOString(), text });
    m[rowId] = arr.slice(0, 50);
    saveLocalMap("erpv2_control_comments_v1", m);
    setLocalTick((x) => x + 1);
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const data = await tryGetJson(["/api/internal/tasks", "/api/tasks"]);
      const tasks = normalizeTasks(data);
      const built = buildRowsFromTasks(tasks);
      if (built.length === 0) {
        setRows(demoRows(new Date().toISOString()));
      } else {
        setRows(built);
      }
    } catch (e: any) {
      setRows(demoRows(new Date().toISOString()));
      setErr(String(e?.message || e || "error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;
    load();
  }, []);

  const panelOpen = Boolean(selected);

  // SidePanel Engine bridge (Control)
  const LS_KEY = "erpv2_control_comments_v1";

  function loadCommentMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  function saveComment(id: string, text: string) {
    const map = loadCommentMap();
    map[id] = text;
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  }

  function evId(ev: any): string {
    return String(ev?.id ?? ev?.key ?? ev?.event_id ?? "");
  }

  function getLocalComment(ev: any): string {
    const id = evId(ev);
    if (!id) return "";
    return loadCommentMap()[id] ?? "";
  }

  function onQuickDone(ev: any) {
    const id = evId(ev);
    if (!id) return;
    // @ts-ignore
    if (typeof (window as any).__erpv2_control_done === "function") {
      // @ts-ignore
      (window as any).__erpv2_control_done(id);
    }
  }

  function onQuickComment(ev: any) {
    const id = evId(ev);
    if (!id) return;
    const cur = getLocalComment(ev);
    const next = window.prompt("Comment", cur ?? "") ?? "";
    saveComment(id, next);
  }

  React.useEffect(() => {
    // @ts-ignore
    if (typeof selected === "undefined") return;
    // @ts-ignore
    if (!selected) { closePanel(); return; }

    // @ts-ignore
    const ev = selected;

    openPanel({
      title: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435",
      subtitle: (ev?.client_label ?? ev?.client_code ?? ""),
      actions: (
        <div className="cp-panel-actions">
          <button className="cp-btn" type="button" onClick={() => onQuickDone(ev)}>
            {"\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e"}
          </button>
          <button className="cp-btn2" type="button" onClick={() => onQuickComment(ev)}>
            {"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"}
          </button>
        </div>
      ),
      sections: [
        {
          title: "\u041e\u0431\u0437\u043e\u0440",
          content: (
            <div className="cp-kv">
              <div><b>Client</b></div><div>{ev?.client_code ?? "-"}</div>
              <div><b>Event</b></div><div>{ev?.event_name ?? ev?.title ?? "-"}</div>
              <div><b>Plan</b></div><div>{ev?.plan_date ?? ev?.due_date ?? "-"}</div>
              <div><b>Status</b></div><div>{ev?.status ?? "-"}</div>
            </div>
          ),
        },
        {
          title: "\u0417\u0430\u043c\u0435\u0442\u043a\u0430",
          content: <div className="cp-muted">{getLocalComment(ev) || "\u041d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u044f."}</div>,
        },
      ],
      widthPx: 460,
    });
  }, [openPanel, closePanel, selected]);
  return (
    <div className="erp-page">
      <div className="erp-page__header">
        <div className="erp-titleblock">
          <div className="erp-kicker">{ui("subtitle")}</div>
          <div className="erp-title-row">
            <div className="erp-title">{ui("control")}</div>
            <button className="erp-btn erp-btn--primary" onClick={load} disabled={loading}>
              {loading ? "..." : ui("refresh")}
            </button>
          </div>
        </div>

        <div className="erp-filters">
          <div className="erp-filter">
            <div className="erp-filter__label">{ui("period")}</div>
            <div className="erp-seg">
              <button className={"erp-seg__item " + (period === "today" ? "is-active" : "")} onClick={() => setPeriod("today")}>
                {ui("today")}
              </button>
              <button className={"erp-seg__item " + (period === "7" ? "is-active" : "")} onClick={() => setPeriod("7")}>
                {ui("d7")}
              </button>
              <button className={"erp-seg__item " + (period === "14" ? "is-active" : "")} onClick={() => setPeriod("14")}>
                {ui("d14")}
              </button>
              <button className={"erp-seg__item " + (period === "30" ? "is-active" : "")} onClick={() => setPeriod("30")}>
                {ui("d30")}
              </button>
            </div>
          </div>

          <div className="erp-filter">
            <div className="erp-filter__label">{ui("client")}</div>
            <select className="erp-select" value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="all">{ui("all")}</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="erp-filter">
            <div className="erp-filter__label">{ui("status")}</div>
            <select className="erp-select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="all">{ui("all")}</option>
              <option value="overdue">{ui("overdue")}</option>
              <option value="soon">{ui("soon")}</option>
              <option value="ok">{ui("ok")}</option>
            </select>
          </div>

          <div className="erp-filter erp-filter--grow">
            <div className="erp-filter__label">{ui("search")}</div>
            <input className="erp-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ui("placeholderSearch")} />
          </div>
        </div>

        {err ? <div className="erp-alert erp-alert--warn">{err}</div> : null}
      </div>

      <div className="erp-layout">
        <div className="erp-listcard">
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="col-client">{ui("client")}</th>
                  <th className="col-event">{ui("control")}</th>
                  <th className="col-date">{ui("period")}</th>
                  <th className="col-status">{ui("status")}</th>
                  <th className="col-actions">{ui("comment")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const done = isDone(r.id);
                  const rowKind = done ? "ok" : r.kind;
                  return (
                    <tr
                      key={r.id}
                      className={"erp-row " + (selectedId === r.id ? "is-selected" : "")}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="col-client">
                        <div className="erp-cell-main">{r.client}</div>
                        <div className="erp-cell-sub">{r.source}</div>
                      </td>
                      <td className="col-event">
                        <div className="erp-cell-main">{r.label}</div>
                        <div className="erp-cell-sub">{s((r.raw as any)?.description || "")}</div>
                      </td>
                      <td className="col-date">
                        <div className="erp-cell-main">{fmtDate(r.planned)}</div>
                        <div className="erp-cell-sub">{s(r.planned || "") ? s(r.planned).slice(0, 10) : ""}</div>
                      </td>
                      <td className="col-status">
                        <span className={badgeClass(rowKind)}>{done ? ui("ok") : badgeText(r.kind)}</span>
                      </td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="erp-actions">
                          <button className="erp-btn erp-btn--primary" onClick={() => markDone(r.id)}>
                            {ui("markDone")}
                          </button>
                          <button className="erp-btn" onClick={() => setSelectedId(r.id)}>
                            {ui("comment")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="erp-empty">
                        <div className="erp-empty__title">{ui("emptyTitle")}</div>
                        <div className="erp-empty__text">{ui("emptyText")}</div>
                        <div className="erp-empty__hint">{ui("emptyHint")}</div>
                        <button className="erp-btn erp-btn--primary" onClick={() => load()}>
                          {ui("refresh")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className={"erp-sidepanel " + (panelOpen ? "is-open" : "")}>
<button className="erp-btn" onClick={() => setSelectedId(null)}>
              {ui("close")}
            </button>
          </div>

          {selected ? <SidePanelBody row={selected} localTick={localTick} onAddComment={addComment} /> : null}
        </div>

        {panelOpen ?
</div>
  );
}

function SidePanelBody(props: { row: ControlRow; localTick: number; onAddComment: (id: string, text: string) => void }) {
  const { row, localTick, onAddComment } = props;
  const [text, setText] = useState("");

  const comments = useMemo(() => {
    const m = loadLocalMap("erpv2_control_comments_v1");
    const arr = Array.isArray(m[row.id]) ? (m[row.id] as any[]) : [];
    return arr;
  }, [row.id, localTick]);

  const done = useMemo(() => {
    const m = loadLocalMap("erpv2_control_done_v1");
    return m[row.id] || null;
  }, [row.id, localTick]);

  // SidePanel Engine bridge (Control)
  const LS_KEY = "erpv2_control_comments_v1";

  function loadCommentMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  function saveComment(id: string, text: string) {
    const map = loadCommentMap();
    map[id] = text;
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  }

  function evId(ev: any): string {
    return String(ev?.id ?? ev?.key ?? ev?.event_id ?? "");
  }

  function getLocalComment(ev: any): string {
    const id = evId(ev);
    if (!id) return "";
    return loadCommentMap()[id] ?? "";
  }

  function onQuickDone(ev: any) {
    const id = evId(ev);
    if (!id) return;
    // @ts-ignore
    if (typeof (window as any).__erpv2_control_done === "function") {
      // @ts-ignore
      (window as any).__erpv2_control_done(id);
    }
  }

  function onQuickComment(ev: any) {
    const id = evId(ev);
    if (!id) return;
    const cur = getLocalComment(ev);
    const next = window.prompt("Comment", cur ?? "") ?? "";
    saveComment(id, next);
  }

  React.useEffect(() => {
    // @ts-ignore
    if (typeof selected === "undefined") return;
    // @ts-ignore
    if (!selected) { closePanel(); return; }

    // @ts-ignore
    const ev = selected;

    openPanel({
      title: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435",
      subtitle: (ev?.client_label ?? ev?.client_code ?? ""),
      actions: (
        <div className="cp-panel-actions">
          <button className="cp-btn" type="button" onClick={() => onQuickDone(ev)}>
            {"\u041e\u0442\u043c\u0435\u0442\u0438\u0442\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e"}
          </button>
          <button className="cp-btn2" type="button" onClick={() => onQuickComment(ev)}>
            {"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439"}
          </button>
        </div>
      ),
      sections: [
        {
          title: "\u041e\u0431\u0437\u043e\u0440",
          content: (
            <div className="cp-kv">
              <div><b>Client</b></div><div>{ev?.client_code ?? "-"}</div>
              <div><b>Event</b></div><div>{ev?.event_name ?? ev?.title ?? "-"}</div>
              <div><b>Plan</b></div><div>{ev?.plan_date ?? ev?.due_date ?? "-"}</div>
              <div><b>Status</b></div><div>{ev?.status ?? "-"}</div>
            </div>
          ),
        },
        {
          title: "\u0417\u0430\u043c\u0435\u0442\u043a\u0430",
          content: <div className="cp-muted">{getLocalComment(ev) || "\u041d\u0435\u0442 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u044f."}</div>,
        },
      ],
      widthPx: 460,
    });
  }, [openPanel, closePanel, selected]);
  return (





</div>
          <div>

</div>
        </div>

        {done ? (
          <div className="erp-alert erp-alert--ok">
            {"done at " + s(done.at).replace("T", " ").slice(0, 16)}
          </div>
        ) : null}
      </div>
</div>

        <div className="erp-formrow">
          <textarea
            className="erp-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={ui("placeholderComment")}
          />
          <button
            className="erp-btn erp-btn--primary"
            onClick={() => {
              const t = text.trim();
              if (!t) return;
              onAddComment(row.id, t);
              setText("");
            }}
          >
            {ui("add")}
          </button>
        </div>

        <div className="erp-commentlist">
          {comments.length === 0 ? <div className="erp-muted">\u2014</div> : null}
          {comments.map((c, idx) => (
            <div key={idx} className="erp-comment">
              <div className="erp-comment__meta">{s(c.at).replace("T", " ").slice(0, 16)}</div>
              <div className="erp-comment__text">{s(c.text)}</div>
            </div>
          ))}
        </div>
      </div>

      <details className="erp-panelcard">
        <summary className="erp-details__summary">{"debug json"}</summary>
        <pre className="erp-code">{JSON.stringify(row.raw || row, null, 2)}</pre>
      </details>
    </div>
  );
}