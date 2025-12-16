import { useEffect, useMemo, useState } from "react";

export type ProcessIntent = {
  clientId: string;
  taskKey: string;
};

const STORAGE_KEY = "erpv2.processIntents.v27";
const EVENT_NAME = "erpv2.processIntents.changed";

function safeParse(raw: string | null): ProcessIntent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x: any) => x && typeof x.clientId === "string" && typeof x.taskKey === "string"
    );
  } catch {
    return [];
  }
}

function readAll(): ProcessIntent[] {
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeAll(items: ProcessIntent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT_NAME));
}

function keyOf(i: ProcessIntent): string {
  return `${i.clientId}::${i.taskKey}`;
}

function normalizeArgs(a: any, b?: any): ProcessIntent | null {
  if (a && typeof a === "object" && typeof a.clientId === "string" && typeof a.taskKey === "string") {
    return { clientId: a.clientId, taskKey: a.taskKey };
  }
  if (typeof a === "string" && typeof b === "string") {
    const clientId = String(a).trim();
    const taskKey = String(b).trim();
    if (!clientId || !taskKey) return null;
    return { clientId, taskKey };
  }
  return null;
}

export function getProcessIntents(): ProcessIntent[] {
  return readAll();
}

export function getProcessIntentsByClient(clientId: string): ProcessIntent[] {
  const cid = String(clientId ?? "").trim();
  if (!cid) return [];
  return readAll().filter(x => x.clientId === cid);
}

export function countProcessIntents(clientId?: string | null): number {
  const items = readAll();
  const cid = String(clientId ?? "").trim();
  if (!cid) return items.length;
  return items.filter(x => x.clientId === cid).length;
}

export function hasProcessIntent(a: any, b?: any): boolean {
  const intent = normalizeArgs(a, b);
  if (!intent) return false;
  const k = keyOf(intent);
  return readAll().some(x => keyOf(x) === k);
}

export function addProcessIntent(a: any, b?: any): void {
  const intent = normalizeArgs(a, b);
  if (!intent) return;
  const items = readAll();
  const k = keyOf(intent);
  if (items.some(x => keyOf(x) === k)) return;
  writeAll([...items, intent]);
}

export function removeProcessIntent(a: any, b?: any): void {
  const intent = normalizeArgs(a, b);
  if (!intent) return;
  const k = keyOf(intent);
  writeAll(readAll().filter(x => keyOf(x) !== k));
}

export function clearProcessIntents(clientId?: any): void {
  const cid = String(clientId ?? "").trim();
  if (!cid) {
    writeAll([]);
    return;
  }
  writeAll(readAll().filter(x => x.clientId !== cid));
}

export async function realizeProcessIntent(a: any, b?: any): Promise<"created" | "exists"> {
  const intent = normalizeArgs(a, b);
  if (!intent) throw new Error("intent_invalid");

  const res = await fetch("/api/internal/process-intents/realize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(intent),
  });

  if (!res.ok) throw new Error("intent_realize_failed");

  const data = await res.json();
  removeProcessIntent(intent);
  return data.status;
}

export async function realizeAllForClient(clientId: string): Promise<void> {
  const cid = String(clientId ?? "").trim();
  if (!cid) return;

  const intents = getProcessIntentsByClient(cid);
  for (const it of intents) {
    try {
      await realizeProcessIntent(it);
    } catch {
      // best-effort, keep going
    }
  }
  clearProcessIntents(cid);
}

export function useProcessIntents() {
  const [items, setItems] = useState<ProcessIntent[]>(() => readAll());

  useEffect(() => {
    const onChange = () => setItems(readAll());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return useMemo(() => {
    return {
      items,
      byClient: getProcessIntentsByClient,
      count: countProcessIntents,
      has: hasProcessIntent,
      add: addProcessIntent,
      remove: removeProcessIntent,
      clear: clearProcessIntents,
      realize: realizeProcessIntent,
      realizeAll: realizeAllForClient,
    };
  }, [items]);
}