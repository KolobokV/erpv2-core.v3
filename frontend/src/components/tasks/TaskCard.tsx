import React from "react";

function t(s: string): string {
  return s;
}

function trTitle(raw: any): string {
  const title = (raw ?? "").toString();

  // Heuristic UI-only translation for common auto-generated titles.
  // Keeps logic intact; only changes what the user sees.
  // Example: "Task for Bank statement request (2025-12)"
  const m = title.match(/^Task for\s+(.+?)\s*(\(\d{4}-\d{2}\))?\s*$/i);
  if (!m) return title;

  const core = (m[1] ?? "").trim();
  const suffix = (m[2] ?? "").trim();

  const map: Record<string, string> = {
    "Bank statement request": "\u0417\u0430\u043f\u0440\u043e\u0441 \u0431\u0430\u043d\u043a\u043e\u0432\u0441\u043a\u0438\u0445 \u0432\u044b\u043f\u0438\u0441\u043e\u043a",
    "Document request": "\u0417\u0430\u043f\u0440\u043e\u0441 \u043f\u0435\u0440\u0432\u0438\u0447\u043d\u044b\u0445 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432",
    "USN advance": "\u0410\u0432\u0430\u043d\u0441 \u043f\u043e \u0423\u0421\u041d",
    "Tourist tax": "\u0422\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0441\u0431\u043e\u0440",
  };

  const translated = map[core] ?? core;
  const base = `${translated}${suffix ? " " + suffix : ""}`;
  return base;
}

export function TaskCard({ task }: any) {
  const clientLabel =
    task.client_name
      ? task.client_name
      : task.client_count
        ? `${task.client_count} \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432`
        : "\u041a\u043b\u0438\u0435\u043d\u0442";

  const sourceLabel = task.is_auto_generated
    ? "\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438"
    : null;

  const title = trTitle(task.title);

  return (
    <div className="task-card">
      <div className="task-title">{t(title)}</div>

      <div className="task-sub">
        {clientLabel}
        {sourceLabel && <span> · {sourceLabel}</span>}
      </div>

      <div className="task-deadline">
        {"\u0421\u0440\u043e\u043a:"} {task.deadline_human}
      </div>
    </div>
  );
}
