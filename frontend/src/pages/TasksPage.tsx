import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { UpBackBar } from "../components/UpBackBar";
import { getClientFromLocation } from "../v27/clientContext";
import { deriveRisk } from "../v27/riskPriority";
import { fetchProcessInstancesV2Safe, type ProcessInstanceV2 } from "../api/processInstancesV2Safe";
import {
  loadMaterializedTasksV27,
  loadMaterializeMetaV27,
} from "../v27/profileStore";
import {
  addProcessIntent,
  hasProcessIntent,
  realizeProcessIntent,
} from "../v27/processIntentsStore";
import { t } from "../i18n/t";

type UiTask = any;
type GroupKey = "burning" | "soon" | "calm" | "unknown";

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

function sortByPriorityAndTitle(a: any, b: any): number {
  const pa = String(a?.derived?.riskLevel ?? "unknown");
  const pb = String(b?.derived?.riskLevel ?? "unknown");
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 9 };
  const da = order[pa] ?? 9;
  const db = order[pb] ?? 9;
  if (da !== db) return da - db;
  const ta = String(a?.title ?? "");
  const tb = String(b?.title ?? "");
  return ta.localeCompare(tb);
}

function riskToGroup(lvl: string): GroupKey {
  if (lvl === "critical") return "burning";
  if (lvl === "high") return "soon";
  if (lvl === "medium" || lvl === "low") return "calm";
  return "unknown";
}

export default function TasksPage() {
  const location = useLocation();
  const query = useQuery();
  const clientId = useMemo(() => getClientFromLocation(location), [location]);

  const qPriority = query.get("priority");
  const qDue = query.get("due");
  const qGroup = query.get("group");

  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [meta, setMeta] = useState<any>({ count: 0 });
  const [procItems, setProcItems] = useState<ProcessInstanceV2[]>([]);
  const [intentRev, setIntentRev] = useState<number>(0);

  useEffect(() => {
    const materialized = loadMaterializedTasksV27(clientId)
      .map((x: any) => {
        const risk = deriveRisk(x.deadline);
        return {
          ...x,
          derived: {
            ...x.derived,
            riskLevel: risk?.level ?? "unknown",
            daysToDeadline: typeof risk?.daysToDeadline === "number" ? risk.daysToDeadline : null,
          },
        };
      })
      .sort(sortByPriorityAndTitle);

    setTasks(materialized);
    setMeta(loadMaterializeMetaV27(clientId));

    fetchProcessInstancesV2Safe()
      .then((resp) => setProcItems(Array.isArray(resp?.items) ? resp.items : []))
      .catch(() => setProcItems([]));

    setIntentRev((x) => x + 1);
  }, [clientId]);

  const filteredTasks = useMemo(() => {
    let out = [...tasks];

    if (qPriority) {
      out = out.filter((x) => String(x?.priority ?? "").toLowerCase() === qPriority.toLowerCase());
    }

    if (qDue) {
      out = out.filter((x) => {
        const d = x?.derived?.daysToDeadline;
        if (typeof d !== "number") return false;
        if (qDue === "today") return d === 0;
        if (qDue === "overdue") return d < 0;
        if (qDue === "next7") return d >= 0 && d <= 7;
        return true;
      });
    }

    if (qGroup) {
      out = out.filter((x) => riskToGroup(String(x?.derived?.riskLevel ?? "unknown")) === qGroup);
    }

    return out;
  }, [tasks, qPriority, qDue, qGroup]);

  const title = clientId ? `${t("tasks.title")}: ${clientId}` : t("tasks.title");

  return (
    <PageShell>
      <UpBackBar title={title} />

      <div style={{ padding: 12 }}>
        {(qPriority || qDue || qGroup) && (
          <div
            style={{
              marginBottom: 10,
              padding: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              fontSize: 12,
              opacity: 0.85,
            }}
          >
            {t("common.activeFilters")}{" "}
            {t("tasks.filtersPrefix")}{" "}
            {qPriority ? t("tasks.priority", { v: qPriority }) : ""}
            {qDue ? " " + t("tasks.due", { v: qDue }) : ""}
            {qGroup ? " " + t("tasks.group", { v: qGroup }) : ""}
            <span
              style={{ marginLeft: 12, cursor: "pointer", textDecoration: "underline" }}
              onClick={() => {
                window.location.href = "/tasks";
              }}
            >
              {t("common.clear")}
            </span>
          </div>
        )}

        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          {t("tasks.showing", { shown: filteredTasks.length, total: tasks.length })}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {filteredTasks.map((x: any) => {
            const lvl = x?.derived?.riskLevel ?? "unknown";
            const tk = String(x?.key ?? "").trim();
            const queued = !!clientId && !!tk && hasProcessIntent(clientId, tk);

            const cardTitle = String(x?.title ?? "").trim().length > 0 ? String(x.title) : t("tasks.untitled");
            const dueText = fmtDate(String(x?.deadline ?? "")) || t("tasks.unknown");

            return (
              <div
                key={x.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12,
                  padding: 10,
                }}
              >
                <div style={{ fontWeight: 700 }}>{cardTitle}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {t("tasks.cardPriority", { v: String(x?.priority ?? "-") })} |{" "}
                  {t("tasks.cardRisk", { v: String(lvl) })} |{" "}
                  {t("tasks.cardDue", { v: dueText })}
                </div>

                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      if (!clientId || !tk) return;
                      addProcessIntent(clientId, tk);
                      setIntentRev((v) => v + 1);
                    }}
                    disabled={!clientId || !tk}
                  >
                    {queued ? t("tasks.queued") : t("tasks.queue")}
                  </button>

                  <button
                    onClick={() => {
                      if (!clientId || !tk) return;
                      void realizeProcessIntent(clientId, tk);
                    }}
                    disabled={!clientId || !tk}
                  >
                    {t("tasks.realize")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}