import { useEffect, useMemo, useState } from "react";
import { apiGetJson, apiPutJson } from "../api";
import { apiUrl } from "../lib/api";
import { t } from "../i18n/t";
import "../ux/reglementLibrary.css";

type RuleType = "monthly" | "quarterly" | "annual" | "custom_months";

type ReglementRule =
  | { type: "monthly"; day: number }
  | { type: "quarterly"; months: number[]; day: number }
  | { type: "annual"; month: number; day: number; yearOffset: number }
  | { type: "custom_months"; months: number[]; day: number };

type ReglementDef = {
  id: string;
  title: string;
  category: string;
  lead_days: number;
  rule: ReglementRule;
};

type StorePayload = { defs: ReglementDef[]; updated_at?: string };

const LS_KEY = "erp_reglement_defs_v2";
const HORIZON_MONTHS = 6;

const ALLOWED_CATS = ["reporting", "banking", "payroll", "internal"] as const;
type AllowedCat = (typeof ALLOWED_CATS)[number];

function normalizeCat(v: string | undefined | null): AllowedCat {
  const s = String(v ?? "").trim();
  if (ALLOWED_CATS.includes(s as any)) return s as AllowedCat;
  return "reporting";
}

function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return fallback;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fmtRu(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function prevWorkdayIfWeekend(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 0 || out.getDay() === 6) out.setDate(out.getDate() - 1);
  return out;
}

function buildDates(def: ReglementDef): Date[] {
  const start = startOfCurrentMonth();
  const dates: Date[] = [];

  for (let i = 0; i < HORIZON_MONTHS; i++) {
    const cur = addMonths(start, i);
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;

    if (def.rule.type === "monthly") {
      const d = prevWorkdayIfWeekend(new Date(y, m - 1, clampInt(def.rule.day, 1, 31, 1)));
      if (d.getMonth() === m - 1) dates.push(d);
      continue;
    }

    if (def.rule.type === "quarterly" && def.rule.months.includes(m)) {
      const d = prevWorkdayIfWeekend(new Date(y, m - 1, clampInt(def.rule.day, 1, 31, 1)));
      if (d.getMonth() === m - 1) dates.push(d);
      continue;
    }

    if (def.rule.type === "custom_months" && def.rule.months.includes(m)) {
      const d = prevWorkdayIfWeekend(new Date(y, m - 1, clampInt(def.rule.day, 1, 31, 1)));
      if (d.getMonth() === m - 1) dates.push(d);
      continue;
    }

    if (def.rule.type === "annual") {
      const month = clampInt(def.rule.month, 1, 12, 1);
      if (m === month) {
        const yy = y + clampInt(def.rule.yearOffset, -2, 2, 0);
        const d = prevWorkdayIfWeekend(new Date(yy, month - 1, clampInt(def.rule.day, 1, 31, 1)));
        if (d.getMonth() === month - 1) dates.push(d);
      }
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

function seedDefs(): ReglementDef[] {
  return [
    { id: "report_usn_annual", title: "\u0423\u0421\u041d (\u0433\u043e\u0434)", category: "reporting", lead_days: 7, rule: { type: "annual", day: 25, month: 4, yearOffset: 1 } },
    { id: "report_vat_monthly", title: "\u041d\u0414\u0421 (\u0435\u0436\u0435\u043c\u0435\u0441\u044f\u0447\u043d\u043e)", category: "reporting", lead_days: 7, rule: { type: "monthly", day: 20 } },
    { id: "report_quarterly_decl", title: "\u0414\u0435\u043a\u043b\u0430\u0440\u0430\u0446\u0438\u0438 \u043f\u043e \u043a\u0432\u0430\u0440\u0442\u0430\u043b\u0430\u043c", category: "reporting", lead_days: 7, rule: { type: "quarterly", months: [1, 4, 7, 10], day: 28 } },
    { id: "payroll_rsv", title: "\u0420\u0421\u0412", category: "payroll", lead_days: 7, rule: { type: "quarterly", months: [1, 4, 7, 10], day: 25 } },
    { id: "payroll_6ndfl", title: "6-\u041d\u0414\u0424\u041b", category: "payroll", lead_days: 7, rule: { type: "custom_months", months: [2, 4, 7, 10], day: 25 } },
    { id: "payroll_personal", title: "\u041f\u0435\u0440\u0441\u043e\u043d\u0438\u0444\u0438\u0446\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u0441\u0432\u0435\u0434\u0435\u043d\u0438\u044f", category: "payroll", lead_days: 7, rule: { type: "monthly", day: 25 } },
    { id: "bank_statement_request", title: "\u0417\u0430\u043f\u0440\u043e\u0441 \u0432\u044b\u043f\u0438\u0441\u043a\u0438 \u0431\u0430\u043d\u043a\u0430", category: "banking", lead_days: 7, rule: { type: "monthly", day: 5 } },
    { id: "internal_close_month", title: "\u0417\u0430\u043a\u0440\u044b\u0442\u0438\u0435 \u043c\u0435\u0441\u044f\u0446\u0430", category: "internal", lead_days: 7, rule: { type: "monthly", day: 10 } },
  ];
}

export default function ReglementPage() {
  const [defs, setDefs] = useState<ReglementDef[]>([]);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("reporting");
  const [status, setStatus] = useState("");
  const [loadWarn, setLoadWarn] = useState("");

  const cats = useMemo(() => {
    return {
      reporting: t("reglementUi.categories.reporting"),
      banking: t("reglementUi.categories.banking"),
      payroll: t("reglementUi.categories.payroll"),
      internal: t("reglementUi.categories.internal"),
    } as Record<string, string>;
  }, []);

  function normalizeDefs(arr: ReglementDef[]): ReglementDef[] {
    return arr.map((d) => ({
      ...d,
      category: normalizeCat(d.category),
      lead_days: clampInt((d as any).lead_days, 0, 365, 7),
    }));
  }

  async function load() {
    setLoadWarn("");
    try {
      const data = await apiGetJson<StorePayload>(apiUrl("/api/internal/reglement/definitions"));
      const arr0 = Array.isArray((data as any)?.defs) ? (data as any).defs : [];
      const arr = normalizeDefs(arr0);
      if (arr.length > 0) {
        setDefs(arr);
        localStorage.setItem(LS_KEY, JSON.stringify({ defs: arr, updated_at: new Date().toISOString() }));
        return;
      }
      const seeded = seedDefs();
      setDefs(seeded);
      localStorage.setItem(LS_KEY, JSON.stringify({ defs: seeded, updated_at: new Date().toISOString() }));
      await apiPutJson(apiUrl("/api/internal/reglement/definitions"), { defs: seeded });
      return;
    } catch {
      setLoadWarn(t("reglementUi.loadError"));
    }

    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as StorePayload;
        if (Array.isArray(p?.defs)) {
          setDefs(normalizeDefs(p.defs));
          return;
        }
      }
    } catch {}

    setDefs(seedDefs());
  }

  async function save(all: ReglementDef[]) {
    setStatus(t("reglementUi.saving"));
    const normalized = normalizeDefs(all);
    setDefs(normalized);
    localStorage.setItem(LS_KEY, JSON.stringify({ defs: normalized, updated_at: new Date().toISOString() }));
    try {
      await apiPutJson(apiUrl("/api/internal/reglement/definitions"), { defs: normalized });
    } catch {}
    setStatus(t("reglementUi.saved"));
    setTimeout(() => setStatus(""), 1200);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return defs.filter((d) => {
      const nc = normalizeCat(d.category);
      const okAllowed = ALLOWED_CATS.includes(nc as any);
      const okQ = !q ? true : (d.title || "").toLowerCase().includes(q) || (nc || "").toLowerCase().includes(q);
      return okAllowed && okQ;
    });
  }, [defs, query]);

  function updateDef(id: string, patch: Partial<ReglementDef>) {
    save(defs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function setRule(id: string, rule: ReglementRule) {
    save(defs.map((d) => (d.id === id ? { ...d, rule } : d)));
  }

  function addNew() {
    const id = `def_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    const d: ReglementDef = {
      id,
      title: "\u041d\u043e\u0432\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435",
      category: "reporting",
      lead_days: 7,
      rule: { type: "monthly", day: 25 },
    };
    save([d, ...defs]);
    setExpandedId(id);
  }

  function deleteDef(id: string) {
    if (!window.confirm(t("reglementUi.confirmDelete"))) return;
    const next = defs.filter((d) => d.id !== id);
    save(next);
    if (expandedId === id) setExpandedId(null);
  }

  return (
    <div className="regl-page">
      <div className="regl-head">
        <div>
          <div className="regl-title">{t("reglementUi.title")}</div>
          <div className="regl-sub">{t("reglementUi.subtitle")}</div>
        </div>
        <div className="regl-actions">
          {status ? <span className="regl-status">{status}</span> : null}
          <button className="btn btn-primary" onClick={addNew}>{t("reglementUi.create")}</button>
        </div>
      </div>

      {loadWarn ? <div className="regl-warn">{loadWarn}</div> : null}

      <div className="regl-filters">
        <div className="regl-filter">
          <div className="regl-label">{t("reglementUi.search")}</div>
          <input className="regl-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("reglementUi.searchPlaceholder")} />
        </div>
        <div className="regl-hint">{t("reglementUi.horizon")}</div>
      </div>

      <div className="regl-sections">
        {(["reporting","banking","payroll","internal"] as const).map((catKey) => {
        const items = filtered.filter((d) => normalizeCat(d.category) === catKey);
        if (items.length === 0) return null;

        return (
          <div key={catKey} className={"regl-section " + (openSection === catKey ? "open" : "")}>
            <button className="regl-section-head" onClick={() => setOpenSection(openSection === catKey ? null : catKey)}>
              <div className="regl-section-title">{cats[catKey]}</div>
              <div className="regl-section-right">
                <div className="regl-section-count">{items.length}</div>
                <div className="regl-section-chev">{openSection === catKey ? "\u25b2" : "\u25bc"}</div>
              </div>
            </button>

            {openSection === catKey ? (
              <div className="regl-list">
              {items.map((d) => {
                const isOpen = expandedId === d.id;
                const dates = buildDates(d);

                return (
                  <div key={d.id} className={"regl-row " + (isOpen ? "open" : "")}>
                    <button
                      className="regl-row-head"
                      onClick={() => setExpandedId(isOpen ? null : d.id)}
                    >
                      <div className="regl-row-main">
                        <div className="regl-row-title">{d.title}</div>
                        <div className="regl-row-meta">
                          <span className="chip">{cats[normalizeCat(d.category)] || d.category}</span>
                          <span className="chip">{t("reglementUi.leadDays")}: {d.lead_days}</span>
                        </div>
                      </div>
                      <div className="regl-row-right">{isOpen ? "\u25b2" : "\u25bc"}</div>
                    </button>

                    {isOpen ? (
                      <div className="regl-expand">
                        <div className="regl-grid">
                          <div className="regl-box">
                            <div className="regl-label">{t("reglementUi.fieldTitle")}</div>
                            <input className="regl-input" value={d.title} onChange={(e) => updateDef(d.id, { title: e.target.value })} />
                          </div>

                          <div className="regl-box">
                            <div className="regl-label">{t("reglementUi.fieldCategory")}</div>
                            <select className="regl-select" value={normalizeCat(d.category)} onChange={(e) => updateDef(d.id, { category: e.target.value })}>
                              {(["reporting","banking","payroll","internal"] as const).map((k) => (<option key={k} value={k}>{cats[k]}</option>))}
                            </select>
                          </div>

                          <div className="regl-box">
                            <div className="regl-label">{t("reglementUi.leadDays")}</div>
                            <input className="regl-input" type="number" value={d.lead_days} onChange={(e) => updateDef(d.id, { lead_days: clampInt(e.target.value, 0, 365, 7) })} />
                          </div>

                          <div className="regl-box">
                            <div className="regl-label">{t("reglementUi.ruleType")}</div>
                            <select
                              className="regl-select"
                              value={d.rule.type}
                              onChange={(e) => {
                                const v = e.target.value as RuleType;
                                if (v === "monthly") setRule(d.id, { type: "monthly", day: 25 });
                                if (v === "quarterly") setRule(d.id, { type: "quarterly", months: [1, 4, 7, 10], day: 25 });
                                if (v === "annual") setRule(d.id, { type: "annual", day: 25, month: 3, yearOffset: 1 });
                                if (v === "custom_months") setRule(d.id, { type: "custom_months", months: [2, 4, 7, 10], day: 25 });
                              }}
                            >
                              <option value="monthly">{t("reglementUi.ruleMonthly")}</option>
                              <option value="quarterly">{t("reglementUi.ruleQuarterly")}</option>
                              <option value="annual">{t("reglementUi.ruleAnnual")}</option>
                              <option value="custom_months">{t("reglementUi.ruleCustomMonths")}</option>
                            </select>
                          </div>

                          <div className="regl-box regl-box-wide">
                            <div className="regl-label">{t("reglementUi.ruleParams")}</div>
                            <div className="regl-params">
                              {d.rule.type === "monthly" ? (
                                <div className="regl-param">
                                  <div className="regl-mini">{t("reglementUi.fieldDay")}</div>
                                  <input className="regl-input" type="number" value={d.rule.day} onChange={(e) => setRule(d.id, { type: "monthly", day: clampInt(e.target.value, 1, 31, 1) })} />
                                </div>
                              ) : null}

                              {d.rule.type === "quarterly" || d.rule.type === "custom_months" ? (
                                <>
                                  <div className="regl-param">
                                    <div className="regl-mini">{t("reglementUi.fieldMonths")}</div>
                                    <input
                                      className="regl-input"
                                      value={d.rule.months.join(",")}
                                      onChange={(e) => {
                                        const arr = e.target.value.split(",").map((x) => clampInt(x.trim(), 1, 12, 1));
                                        const months = Array.from(new Set(arr)).filter(Boolean).sort((a, b) => a - b);
                                        if (d.rule.type === "quarterly") setRule(d.id, { type: "quarterly", months, day: d.rule.day });
                                        else setRule(d.id, { type: "custom_months", months, day: d.rule.day });
                                      }}
                                    />
                                  </div>
                                  <div className="regl-param">
                                    <div className="regl-mini">{t("reglementUi.fieldDay")}</div>
                                    <input
                                      className="regl-input"
                                      type="number"
                                      value={d.rule.day}
                                      onChange={(e) => {
                                        const day = clampInt(e.target.value, 1, 31, 1);
                                        if (d.rule.type === "quarterly") setRule(d.id, { type: "quarterly", months: d.rule.months, day });
                                        else setRule(d.id, { type: "custom_months", months: d.rule.months, day });
                                      }}
                                    />
                                  </div>
                                </>
                              ) : null}

                              {d.rule.type === "annual" ? (
                                <>
                                  <div className="regl-param">
                                    <div className="regl-mini">{t("reglementUi.fieldDay")}</div>
                                    <input className="regl-input" type="number" value={d.rule.day} onChange={(e) => setRule(d.id, { type: "annual", day: clampInt(e.target.value, 1, 31, 1), month: d.rule.month, yearOffset: d.rule.yearOffset })} />
                                  </div>
                                  <div className="regl-param">
                                    <div className="regl-mini">{t("reglementUi.fieldMonth")}</div>
                                    <input className="regl-input" type="number" value={d.rule.month} onChange={(e) => setRule(d.id, { type: "annual", day: d.rule.day, month: clampInt(e.target.value, 1, 12, 1), yearOffset: d.rule.yearOffset })} />
                                  </div>
                                  <div className="regl-param">
                                    <div className="regl-mini">{t("reglementUi.fieldYearOffset")}</div>
                                    <input className="regl-input" type="number" value={d.rule.yearOffset} onChange={(e) => setRule(d.id, { type: "annual", day: d.rule.day, month: d.rule.month, yearOffset: clampInt(e.target.value, -2, 2, 0) })} />
                                  </div>
                                </>
                              ) : null}
                            </div>

                            <div className="regl-danger">
                              <button className="btn btn-danger" onClick={() => deleteDef(d.id)}>{t("reglementUi.delete")}</button>
                            </div>
                          </div>
                        </div>

                        <div className="regl-dates">
                          <div className="regl-label">{t("reglementUi.upcomingDates")}</div>
                          <div className="regl-date-list">
                            {dates.map((dt) => (
                              <div key={isoDate(dt)} className="regl-date-row">
                                <div className="regl-date">{fmtRu(dt)}</div>
                                <div className="regl-date-meta">{isoDate(dt)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              </div>
            ) : null}
          </div>
        );
      })}</div>
    </div>
  );
}
