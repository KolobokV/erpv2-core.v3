export type DerivedItem = {
  key: string;
  title?: string;
  source?: string;
  reason?: string;
  periodicity?: string;
};

export type LocalTask = {
  key?: string;
  title?: string;
  dueDateIso?: string | null;
  priority?: string;
  status?: string;
};

export type CoverageResult = {
  derivedTotal: number;
  tasksTotal: number;
  covered: number;
  uncovered: number;
  coveredKeys: string[];
  uncoveredItems: DerivedItem[];
};

function safeKey(x: any): string {
  const s = String(x ?? "").trim();
  return s;
}

export function computeCoverageFromDerivedAndTasks(derived: any[], tasks: any[]): CoverageResult {
  const d = Array.isArray(derived) ? derived : [];
  const t = Array.isArray(tasks) ? tasks : [];

  const derivedItems: DerivedItem[] = d
    .map((it: any) => ({
      key: safeKey(it?.key),
      title: typeof it?.title === "string" ? it.title : undefined,
      source: typeof it?.source === "string" ? it.source : undefined,
      reason: typeof it?.reason === "string" ? it.reason : undefined,
      periodicity: typeof it?.periodicity === "string" ? it.periodicity : undefined,
    }))
    .filter((it) => it.key.length > 0);

  const taskKeys = new Set<string>();
  for (const x of t) {
    const k = safeKey(x?.key);
    if (k) taskKeys.add(k);
  }

  const coveredKeys: string[] = [];
  const uncoveredItems: DerivedItem[] = [];

  for (const it of derivedItems) {
    if (taskKeys.has(it.key)) coveredKeys.push(it.key);
    else uncoveredItems.push(it);
  }

  return {
    derivedTotal: derivedItems.length,
    tasksTotal: t.length,
    covered: coveredKeys.length,
    uncovered: uncoveredItems.length,
    coveredKeys,
    uncoveredItems,
  };
}