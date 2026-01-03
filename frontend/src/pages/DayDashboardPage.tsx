import { useEffect, useMemo, useState } from "react";
import { fetchTasksSafe, type TaskItem } from "../api/tasksSafe";

type Bucket = {
  key: string;
  title: string;
  subtitle: string;
  items: TaskItem[];
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDateKey(s?: string) {
  if (!s) return null;
  const m = /^\d{4}-\d{2}-\d{2}/.exec(String(s));
  if (!m) return null;
  const [y, mo, da] = m[0].split("-").map((x) => parseInt(x, 10));
  if (!y || !mo || !da) return null;
  return new Date(y, mo - 1, da);
}

function isDone(status?: string) {
  const s = String(status || "").toLowerCase();
  return s === "done" || s === "completed" || s === "closed";
}

function decodeUnicodeEscapesMaybe(input: string) {
  // If the string contains literal \uXXXX sequences, try to decode them.
  if (!input.includes("\\u")) return input;
  try {
    // Wrap into JSON string and parse.
    const json = `"${input.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}"`;
    const parsed = JSON.parse(json);
    return typeof parsed === "string" ? parsed : input;
  } catch {
    return input;
  }
}

function taskTitle(t: TaskItem) {
  const raw = String(t.title || t.id || "task");
  return decodeUnicodeEscapesMaybe(raw);
}

function DeadlinePill({ deadline }: { deadline?: string }) {
  const d = String(deadline || "").slice(0, 10);
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid rgba(120,120,140,0.35)",
        background: "rgba(120,120,140,0.10)",
      }}
      title={deadline || ""}
    >
      {d || "no-deadline"}
    </span>
  );
}

function BucketCard({ b }: { b: Bucket }) {
  return (
    <section
      style={{
        border: "1px solid rgba(120,120,140,0.20)",
        borderRadius: 16,
        padding: 12,
        background: "rgba(255,255,255,0.65)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{b.title}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{b.subtitle}</div>
        <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
          {b.items.length}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        {b.items.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>empty</div>
        ) : (
          b.items.map((t, idx) => (
            <div
              key={(t.id || t.title || "t") + ":" + idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid rgba(120,120,140,0.15)",
                background: "rgba(255,255,255,0.7)",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {taskTitle(t)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  {(t.client_id && `client: ${t.client_id}`) || "client: -"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <DeadlinePill deadline={t.deadline} />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function DayDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchTasksSafe()
      .then((res) => {
        if (!alive) return;
        setTasks(Array.isArray(res?.tasks) ? res.tasks : []);
      })
      .catch((e) => {
        if (!alive) return;
        setTasks([]);
        setError(String(e?.message || e || "failed"));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const buckets = useMemo(() => {
    const now = new Date();
    const todayKey = toDateKey(now);
    const today = parseDateKey(todayKey) || now;
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end7 = new Date(startToday);
    end7.setDate(end7.getDate() + 7);

    const pending = tasks.filter((t) => !isDone(t.status));

    const overdue: TaskItem[] = [];
    const dueToday: TaskItem[] = [];
    const upcoming7: TaskItem[] = [];
    const inProgress: TaskItem[] = [];

    for (const t of pending) {
      const d = parseDateKey(t.deadline);
      const st = String(t.status || "").toLowerCase();

      if (st === "in_progress" || st === "doing" || st === "wip") {
        inProgress.push(t);
      }

      if (!d) continue;

      if (d < startToday) overdue.push(t);
      else if (toDateKey(d) === todayKey) dueToday.push(t);
      else if (d >= startToday && d < end7) upcoming7.push(t);
    }

    const focus: TaskItem[] = [...overdue, ...dueToday, ...upcoming7].slice(0, 7);

    return [
      { key: "focus", title: "Focus", subtitle: "top items", items: focus },
      { key: "overdue", title: "Overdue", subtitle: "should be done earlier", items: overdue },
      { key: "inprog", title: "In progress", subtitle: "today work", items: inProgress },
      { key: "today", title: "Due today", subtitle: "deadline today", items: dueToday },
      { key: "up7", title: "Next 7 days", subtitle: "prepare ahead", items: upcoming7 },
    ] as Bucket[];
  }, [tasks]);

  const dateKey = useMemo(() => toDateKey(new Date()), []);

  return (
    <div style={{ padding: 14, maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 950 }}>Day</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>{dateKey}</div>
        {loading ? (
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>loading</div>
        ) : (
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
            tasks: {tasks.length}
          </div>
        )}
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(255,120,80,0.35)",
            borderRadius: 16,
            padding: 12,
            background: "rgba(255,120,80,0.08)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          error: {error}
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {buckets.map((b) => (
          <BucketCard key={b.key} b={b} />
        ))}
      </div>
    </div>
  );
}
