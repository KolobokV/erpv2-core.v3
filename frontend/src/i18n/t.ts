import { ru } from "./ru";

type Dict = Record<string, any>;

function getByPath(obj: Dict, path: string): any {
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = cur[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const k of Object.keys(vars)) {
    const v = String(vars[k]);
    out = out.replaceAll("{{" + k + "}}", v);
  }
  return out;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const value = getByPath(ru as any, key);
  if (typeof value !== "string") return key;
  return interpolate(value, vars);
}