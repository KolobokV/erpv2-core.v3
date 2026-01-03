import React from "react";
import { getDeadlineStatus, getDeadlineClass, getPriorityClass, TaskPriority } from "../../ui/taskUx";
import "../../ui/taskUx.css";

export type TaskCardTask = {
  id: string;
  title?: string | null;
  status?: string | null;
  priority?: TaskPriority | null;
  deadline?: string | null;
  client_id?: string | null;
};

export type TaskCardProps = {
  task: TaskCardTask;
  onClick?: (task: TaskCardTask) => void;
  onSetStatus?: (taskId: string, nextStatus: string) => void;
  compact?: boolean;
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function normalizeTitle(task: TaskCardTask): string {
  const t = (task.title || "").trim();
  if (t) return t;
  return task.id;
}

function normalizeStatus(task: TaskCardTask): string {
  const s = (task.status || "").trim();
  return s || "unknown";
}

function stop(e: React.MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

function ActionButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}): JSX.Element {
  const { label, onClick, disabled } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid #e2e8f0",
        background: disabled ? "#f8fafc" : "#ffffff",
        color: disabled ? "#94a3b8" : "#0f172a",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function TaskCard(props: TaskCardProps) {
  const { task, onClick, onSetStatus, compact } = props;

  const deadlineStatus = getDeadlineStatus(task.deadline ?? null);
  const deadlineClass = getDeadlineClass(deadlineStatus);
  const priorityClass = getPriorityClass(task.priority ?? null);

  const clickable = typeof onClick === "function";
  const status = normalizeStatus(task);

  const canAct = typeof onSetStatus === "function";

  const primaryActions = (() => {
    if (!canAct) return null;

    const isDone = status === "done" || status === "completed";
    const isInProgress = status === "in_progress" || status === "in-progress";

    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {!isDone && (
          <ActionButton
            label={isInProgress ? "In progress" : "Start"}
            onClick={() => onSetStatus(task.id, "in_progress")}
            disabled={isInProgress}
          />
        )}
        {!isDone && (
          <ActionButton label="Done" onClick={() => onSetStatus(task.id, "done")} />
        )}
        {isDone && (
          <ActionButton label="Reopen" onClick={() => onSetStatus(task.id, "planned")} />
        )}
      </div>
    );
  })();

  return (
    <div
      className={[
        "rounded-lg border border-slate-200 bg-white",
        "px-3 py-2",
        priorityClass,
        deadlineClass,
        clickable ? "cursor-pointer hover:border-slate-300" : "",
      ].join(" ")}
      onClick={clickable ? () => onClick(task) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick(task);
            }
          : undefined
      }
      data-task-id={task.id}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
            {normalizeTitle(task)}
          </div>

          {!compact && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#475569" }}>
              <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                status: {status}
              </span>
              <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                priority: {task.priority || "medium"}
              </span>
              <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                deadline: {formatDateTime(task.deadline)}
              </span>
              {task.client_id && (
                <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                  client: {task.client_id}
                </span>
              )}
            </div>
          )}

          {compact && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "#475569" }}>
              <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                {task.priority || "medium"}
              </span>
              <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                {deadlineStatus}
              </span>
              <span style={{ background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                {formatDateTime(task.deadline)}
              </span>
            </div>
          )}
        </div>

        {primaryActions ? (
          <div onClick={stop} style={{ flexShrink: 0 }}>
            {primaryActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TaskCard;
