import { useEffect, useMemo, useState } from "react";

function pad2(n: number) {
  return n < 10 ? "0" + n : String(n);
}

function formatMsk(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "short",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const hh = map.hour ? pad2(parseInt(map.hour, 10)) : "--";
  const mm = map.minute ? pad2(parseInt(map.minute, 10)) : "--";
  const ss = map.second ? pad2(parseInt(map.second, 10)) : "--";
  const wd = map.weekday || "";
  const dd = map.day || "";
  const mon = map.month || "";
  const yy = map.year || "";

  return `MSK ${hh}:${mm}:${ss}  |  ${wd}, ${dd} ${mon} ${yy}`;
}

export function MoscowClock(props: { className?: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const text = useMemo(() => formatMsk(new Date()), [tick]);

  return <div className={props.className || "erp-clock"}>{text}</div>;
}
