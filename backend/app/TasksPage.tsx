import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { UpBackBar } from "../components/UpBackBar";
import { getClientFromLocation } from "../v27/clientContext";
import { deriveRisk } from "../v27/riskPriority";
import { fetchProcessInstancesV2Safe, type ProcessInstanceV2 } from "../api/processInstancesV2Safe";
import { loadMaterializedTasksV27, loadMaterializeMetaV27 } from "../v27/profileStore";
import { addProcessIntent, hasProcessIntent, realizeProcessIntent } from "../v27/processIntentsStore";
import { t } from "../i18n/t";

type UiTask = any;
type GroupKey = "burning" | "soon" | "calm" | "unknown";
type DueKey = "all" | "overdue" | "today" | "next7";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch {
    return iso;
  }
}

function riskToGroup(lvl: string): GroupKey {
  if (lvl === "critical") return "burning";
  if (lvl === "high") return "soon";
  if (lvl === "medium" || lvl === "low") return "calm";
  return "unknown";
}

function dueBucket(daysToDeadline: number | null | undefined): DueKey {
  if (typeof daysToDeadline !== "number") return "all";
  if (daysToDeadline < 0) return "overdue";
  if (daysToDeadline === 0) return "today";
  if (daysToDeadline >= 0 && daysToDeadline <= 7) return "next7";
  return "all";
}

function pill(text: string): JSX.Element {
  // v32.4: unified status style + quick actions (visual only)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid rgba(15,23,42,0.12)",
        background: "rgba(255,255,255,0.9)",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        color: "rgba(15,23,42,0.75)",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

import { STATUS_STYLE } from "../ui/statusStyle";

function badge(text: string, kind: "neutral" | "good" | "warn" | "bad"): JSX.Element {
  const map: Record<string, { bg: string; border: string; color: string }> = {
    neutral: { bg: "rgba(15,23,42,0.03)", border: "rgba(15,23,42,0.10)", color: "rgba(15,23,42,0.80)" },
    good: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", color: "rgba(5,150,105,1)" },
    warn: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.28)", color: "rgba(180,83,9,1)" },
    bad: { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)", color: "rgba(185,28,28,1)" },
  };
  const s = map[kind] || map.neutral;
  // v32.4: unified status style + quick actions (visual only)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid " + s.border,
        background: s.bg,
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        color: s.color,
        whiteSpace: "nowrap",
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}

function riskBadge(level: string): JSX.Element {
  const lvl = String(level || "unknown").toLowerCase();
  if (lvl === "critical") return badge("critical", "bad");
  if (lvl === "high") return badge("high", "warn");
  if (lvl === "medium") return badge("medium", "neutral");
  if (lvl === "low") return badge("low", "good");
  return badge("unknown", "neutral");
}

function groupBadge(group: GroupKey): JSX.Element {
  if (group === "burning") return badge("burning", "bad");
  if (group === "soon") return badge("soon", "warn");
  if (group === "calm") return badge("calm", "good");
  return badge("unknown", "neutral");
}

function EmptyTasks() {
  // v32.4: unified status style + quick actions (visual only)
  return (
    <div
      style={{
        border: "1px dashed rgba(15,23,42,0.18)",
        borderRadius: 16,
        padding: 18,
        background: "rgba(255,255,255,0.85)",
        color: "rgba(15,23,42,0.65)",
        fontSize: 13,
      }}
    >
      {"No tasks for selected filters"}
    </div>
  );
}

export default function TasksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useQuery();
  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const qPriority = query.get("priority");
  const qDue = query.get("due") as DueKey | null;
  const qGroup = query.get("group") as GroupKey | null;

  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [meta, setMeta] = useState<any>({ count: 0 });
  const [procItems, setProcItems] = useState<ProcessInstanceV2[]>([]);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const materialized = loadMaterializedTasksV27(clientId).map((x: any) => {
      const risk = deriveRisk(x.deadline);
      return {
        ...x,
        derived: {
          ...x.derived,
          riskLevel: risk?.level ?? "unknown",
          daysToDeadline: typeof risk?.daysToDeadline === "number" ? risk.daysToDeadline : null,
        },
      };
    });

    setTasks(materialized);
    setMeta(loadMaterializeMetaV27(clientId));

    fetchProcessInstancesV2Safe()
      .then((resp) => setProcItems(Array.isArray(resp?.items) ? resp.items : []))
      .catch(() => setProcItems([]));
  }, [clientId]);

  const filtered = useMemo(() => {
    let out = [...tasks];

    if (qPriority) {
      out = out.filter((x) => String(x?.priority ?? "").toLowerCase() === qPriority.toLowerCase());
    }

    if (qDue && qDue !== "all") {
      out = out.filter((x) => dueBucket(x?.derived?.daysToDeadline) === qDue);
    }

    if (qGroup) {
      out = out.filter((x) => riskToGroup(String(x?.derived?.riskLevel ?? "unknown")) === qGroup);
    }

    const s = String(search || "").trim().toLowerCase();
    if (s) {
      out = out.filter((x) => String(x?.title ?? "").toLowerCase().includes(s));
    }

    out.sort((a, b) => {
      const da = (a?.derived?.daysToDeadline ?? 999999) as number;
      const db = (b?.derived?.daysToDeadline ?? 999999) as number;
      if (da !== db) return da - db;
      const ra = String(a?.derived?.riskLevel ?? "unknown");
      const rb = String(b?.derived?.riskLevel ?? "unknown");
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 9 };
      const oa = order[ra] ?? 9;
      const ob = order[rb] ?? 9;
      if (oa !== ob) return oa - ob;
      return String(a?.title ?? "").localeCompare(String(b?.title ?? ""));
    });

    return out;
  }, [tasks, qPriority, qDue, qGroup, search]);

  const title = clientId ? `${t("tasks.title")}: ${clientId}` : t("tasks.title");

  const dueValue: DueKey = qDue || "all";
  const groupValue: string = qGroup || "all";
  const prValue: string = qPriority || "all";

  const buildHref = (patch: Record<string, string | null>) => {
    const u = new URL(window.location.href);
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (v === null || v === "" || v === "all") u.searchParams.delete(k);
      else u.searchParams.set(k, v);
    }
    return u.pathname + "?" + u.searchParams.toString();
  };

  const right = (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <a className="erp-btn erp-btn-ghost" href={clientId ? ("/day?client=" + encodeURIComponent(clientId)) : "/day"}>
        {t("day.title")}
      </a>
      <a className="erp-btn erp-btn-ghost" href={clientId ? ("/client-profile?client=" + encodeURIComponent(clientId)) : "/client-profile"}>
        {"Client"}
      </a>
      <button type="button" className="erp-btn erp-btn-sm" onClick={() => navigate("/tasks")}>
        {t("common.clear")}
      </button>
    </div>
  );

  // v32.4: unified status style + quick actions (visual only)
  return (
    <PageShell>
      <UpBackBar title={title} onUp={() => navigate("/")} right={right} />

      <div style={{ padding: 12 }}>
        <div
          style={{
            border: "1px solid rgba(15,23,42,0.12)",
            background: "rgba(255,255,255,0.95)",
            borderRadius: 16,
            padding: 12,
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {pill(t("tasks.showing", { shown: filtered.length, total: tasks.length }))}

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("tasks.table.searchPh")}
                style={{
                  width: 280,
                  maxWidth: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.14)",
                  padding: "8px 10px",
                  fontSize: 11,
                  outline: "none",
                }}
              />

              <select
                value={dueValue}
                onChange={(e) => {
                  window.location.href = buildHref({ due: e.target.value });
                }}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.14)",
                  padding: "8px 10px",
                  fontSize: 11,
                  background: "white",
                }}
              >
                <option value="all">{t("tasks.table.dueAll")}</option>
                <option value="overdue">{t("tasks.table.dueOverdue")}</option>
                <option value="today">{t("tasks.table.dueToday")}</option>
                <option value="next7">{t("tasks.table.dueNext7")}</option>
              </select>

              <select
                value={groupValue}
                onChange={(e) => {
                  const v = e.target.value;
                  window.location.href = buildHref({ group: v === "all" ? null : v });
                }}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.14)",
                  padding: "8px 10px",
                  fontSize: 11,
                  background: "white",
                }}
              >
                <option value="all">{t("tasks.table.groupAll")}</option>
                <option value="burning">burning</option>
                <option value="soon">soon</option>
                <option value="calm">calm</option>
                <option value="unknown">unknown</option>
              </select>

              <select
                value={prValue}
                onChange={(e) => {
                  const v = e.target.value;
                  window.location.href = buildHref({ priority: v === "all" ? null : v });
                }}
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.14)",
                  padding: "8px 10px",
                  fontSize: 11,
                  background: "white",
                }}
              >
                <option value="all">{t("tasks.table.prAll")}</option>
                <option value="urgent">urgent</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>

              <a
                href="/tasks"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.14)",
                  padding: "8px 10px",
                  fontSize: 11,
                  textDecoration: "none",
                  color: "rgba(15,23,42,0.85)",
                  background: "white",
                }}
              >
                {t("common.clear")}
              </a>
            </div>

            {!clientId ? (
              <div style={{ fontSize: 11, color: "rgba(15,23,42,0.55)" }}>
                {t("tasks.table.noClientHint")}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(15,23,42,0.12)",
            background: "rgba(255,255,255,0.98)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 11 }}>
              <thead>
                <tr style={{ background: "rgba(15,23,42,0.03)" }}>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)" }}>{t("tasks.table.colTask")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)", width: 120 }}>{t("tasks.table.colDeadline")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)", width: 120 }}>{t("tasks.table.colPriority")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)", width: 120 }}>{t("tasks.table.colRisk")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)", width: 120 }}>{t("tasks.table.colGroup")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)", width: 110 }}>{t("tasks.table.colIntent")}</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(15,23,42,0.10)", width: 220 }}>{t("tasks.table.colActions")}</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((x: any) => {
                  const lvl = String(x?.derived?.riskLevel ?? "unknown");
                  const grp = riskToGroup(lvl);
                  const key = String(x?.key ?? x?.task_key ?? x?.intent_key ?? x?.template_key ?? x?.process_key ?? "").trim();
                  const inQueue = !!clientId && !!key && hasProcessIntent(clientId, key);
                  const title = String(x?.title ?? "").trim().length > 0 ? String(x.title) : t("tasks.untitled");
                  const due = x?.deadline ? fmtDate(String(x.deadline)) : t("tasks.unknown");
                  const pr = String(x?.priority ?? "-");

                  // v32.4: unified status style + quick actions (visual only)
  return (
                    <tr key={String(x?.id ?? "") + ":" + key}>
                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                        <div style={{ fontWeight: 700, color: "rgba(15,23,42,0.92)" }}>{title}</div>
                        {key ? <div style={{ marginTop: 2, color: "rgba(15,23,42,0.55)" }}>{key}</div> : null}
                      </td>

                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)", verticalAlign: "top" }}>
                        {due}
                      </td>

                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)", verticalAlign: "top" }}>
                        {badge(pr, "neutral")}
                      </td>

                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)", verticalAlign: "top" }}>
                        {riskBadge(lvl)}
                      </td>

                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)", verticalAlign: "top" }}>
                        {groupBadge(grp)}
                      </td>

                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)", verticalAlign: "top" }}>
                        {inQueue ? badge(t("tasks.table.intentYes"), "good") : badge(t("tasks.table.intentNo"), "neutral")}
                      </td>

                      <td style={{ padding: 8, borderBottom: "1px solid rgba(15,23,42,0.08)", verticalAlign: "top" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            disabled={!clientId || !key}
                            onClick={() => {
                              if (!clientId || !key) return;
                              addProcessIntent(clientId, key);
                            }}
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(15,23,42,0.14)",
                              background: "white",
                              padding: "8px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: !clientId || !key ? "not-allowed" : "pointer",
                              opacity: !clientId || !key ? 0.5 : 1,
                            }}
                          >
                            {inQueue ? t("tasks.queued") : t("tasks.queue")}
                          </button>

                          <button
                            type="button"
                            disabled={!clientId || !key}
                            onClick={() => {
                              if (!clientId || !key) return;
                              void realizeProcessIntent(clientId, key);
                            }}
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(15,23,42,0.14)",
                              background: "white",
                              padding: "8px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: !clientId || !key ? "not-allowed" : "pointer",
                              opacity: !clientId || !key ? 0.5 : 1,
                            }}
                          >
                            {t("tasks.realize")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 14 }}>
                      <EmptyTasks />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(15,23,42,0.55)" }}>
          meta.count: {String(meta?.count ?? "-")} | proc.items: {String(procItems?.length ?? 0)}
        </div>
      </div>
    </PageShell>
  );
}
