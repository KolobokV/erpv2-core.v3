import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGetJson, apiPutJson } from "../api";
import "../ux/clientProfileEdit.css";

type ClientProfileDto = {
  id: string;
  name?: string;
  tax_system?: string;
  tourist_tax?: boolean;
  salary_dates?: any;
  contacts?: {
    email?: string;
    phone?: string;
    person?: string;
  };
  updated_at?: string;
};

function tFactory() {
  const dict: Record<string, string> = {
    kicker: "\u041a\u043b\u0438\u0435\u043d\u0442 \u00b7 \u041f\u0440\u0430\u0432\u043a\u0430",
    title: "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430",
    back: "\u041d\u0430\u0437\u0430\u0434",
    cancel: "\u041e\u0442\u043c\u0435\u043d\u0430",
    save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
    saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    basic: "\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435",
    taxes: "\u041d\u0430\u043b\u043e\u0433\u0438 \u0438 \u0444\u043b\u0430\u0433\u0438",
    label: "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435",
    taxSystem: "\u0420\u0435\u0436\u0438\u043c \u043d\u0430\u043b\u043e\u0433\u043e\u043e\u0431\u043b\u043e\u0436\u0435\u043d\u0438\u044f",
    touristTax: "\u0422\u0443\u0440\u0441\u0431\u043e\u0440",
    payroll: "\u0417\u0430\u0440\u043f\u043b\u0430\u0442\u0430",
    salary1: "\u0414\u0435\u043d\u044c \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u044b #1",
    salary2: "\u0414\u0435\u043d\u044c \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u044b #2",
    salaryHint: "\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u044f: 1-31. \u041f\u0443\u0441\u0442\u043e \u2014 \u0435\u0441\u043b\u0438 \u043d\u0435 \u043d\u0443\u0436\u043d\u043e.",
    advancedJson: "\u0414\u043e\u043f.\u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 (JSON)",
    salaryHelp: "\u041f\u0440\u0438\u043c\u0435\u0440: { \"salary_1\": 10, \"salary_2\": 25 }",
    contacts: "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b",
    email: "\u042d\u043b.\u043f\u043e\u0447\u0442\u0430",
    phone: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d",
    person: "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e",
    footerNote: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f. \u0412\u043e\u0437\u0432\u0440\u0430\u0442 \u2014 \u0432 \u0441\u043f\u0438\u0441\u043e\u043a.",
    jsonErr: "salary_dates JSON parse error.",
    saved: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e",
    unsaved: "\u041d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e",
  };

  return (k: string) => dict[k] ?? k;
}

function safeJsonStringify(v: any) {
  try {
    if (v === null || v === undefined) return "";
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

function safeJsonParse(v: string): any {
  try {
    if (!v.trim()) return {};
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function clampDay(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1 || i > 31) return null;
  return i;
}

export default function ClientProfileEditPage() {
  const t = useMemo(() => tFactory(), []);
  const nav = useNavigate();
  const params = useParams();
  const id = (params as any)?.id as string | undefined;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [name, setName] = useState("");
  const [taxSystem, setTaxSystem] = useState("");
  const [touristTax, setTouristTax] = useState(false);

  const [salary1, setSalary1] = useState<string>("");
  const [salary2, setSalary2] = useState<string>("");
  const [salaryJson, setSalaryJson] = useState<string>("{}");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jsonErr, setJsonErr] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [person, setPerson] = useState("");

  const load = async () => {
    if (!id) return;
    setErr("");
    setJsonErr("");
    setLoading(true);

    try {
      const dto = (await apiGetJson(`/api/internal/client-profiles/${encodeURIComponent(id)}`)) as ClientProfileDto;

      setName(dto.name || "");
      setTaxSystem(dto.tax_system || "");
      setTouristTax(Boolean(dto.tourist_tax));

      const salary = dto.salary_dates ?? {};
      const s1 = salary?.salary_1 ?? salary?.salary1 ?? salary?.day1 ?? null;
      const s2 = salary?.salary_2 ?? salary?.salary2 ?? salary?.day2 ?? null;

      setSalary1(s1 !== null && s1 !== undefined ? String(s1) : "");
      setSalary2(s2 !== null && s2 !== undefined ? String(s2) : "");
      setSalaryJson(safeJsonStringify(salary) || "{}");

      setEmail(dto.contacts?.email || "");
      setPhone(dto.contacts?.phone || "");
      setPerson(dto.contacts?.person || "");
    } catch (e: any) {
      setErr(String(e?.message || e || "error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep JSON in sync when user edits the structured salary fields
  useEffect(() => {
    const obj = safeJsonParse(salaryJson);
    if (obj === null) return;

    const v1 = clampDay(salary1);
    const v2 = clampDay(salary2);

    const next = { ...(obj || {}) } as any;

    if (v1 === null) delete next.salary_1;
    else next.salary_1 = v1;

    if (v2 === null) delete next.salary_2;
    else next.salary_2 = v2;

    const str = safeJsonStringify(next) || "{}";
    if (str !== salaryJson) setSalaryJson(str);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salary1, salary2]);

  const save = async () => {
    if (!id) return;

    setErr("");
    setJsonErr("");
    setSaving(true);

    const salaryObj = safeJsonParse(salaryJson);
    if (salaryObj === null) {
      setJsonErr(t("jsonErr"));
      setSaving(false);
      return;
    }

    const body: ClientProfileDto = {
      id,
      name,
      tax_system: taxSystem,
      tourist_tax: touristTax,
      salary_dates: salaryObj,
      contacts: {
        email,
        phone,
        person,
      },
    };

    try {
      await apiPutJson(`/api/internal/client-profiles/${encodeURIComponent(id)}`, body);
      nav("/client-profile?client=" + encodeURIComponent(id));
    } catch (e: any) {
      setErr(String(e?.message || e || "error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page erp-client-edit-page">
      <div className="erp-page-inner">
        <div className="erp-page-head erp-client-edit-head">
          <div className="min-w-0">
            <div className="erp-kicker">{t("kicker")}</div>
            <div className="erp-h1">
              {t("title")} {id ? <span className="font-mono text-xs text-slate-500">{"#" + id}</span> : null}
            </div>
            <div className="mt-1 text-sm text-slate-500">{t("footerNote")}</div>
          </div>
        </div>

        {loading ? <div className="erp-muted">{t("loading")}</div> : null}
        {err ? <div className="erp-alert erp-alert-danger">{err}</div> : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("basic")}</div>

              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="erp-field">
                  <div className="erp-label">{t("label")}</div>
                  <input className="erp-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={"Acme LLC"} />
                </div>

                <div className="erp-field">
                  <div className="erp-label">{t("taxSystem")}</div>
                  <input className="erp-input" value={taxSystem} onChange={(e) => setTaxSystem(e.target.value)} placeholder={"usn_income_minus_expense"} />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={touristTax} onChange={(e) => setTouristTax(e.target.checked)} />
                  <span className="text-sm text-slate-700">{t("touristTax")}</span>
                </label>
              </div>
            </div>

            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("payroll")}</div>

              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="erp-field">
                  <div className="erp-label">{t("salary1")}</div>
                  <input className="erp-input" value={salary1} onChange={(e) => setSalary1(e.target.value)} placeholder={"10"} inputMode="numeric" />
                </div>
                <div className="erp-field">
                  <div className="erp-label">{t("salary2")}</div>
                  <input className="erp-input" value={salary2} onChange={(e) => setSalary2(e.target.value)} placeholder={"25"} inputMode="numeric" />
                </div>
                <div className="erp-field erp-field-inlineAction">
                  <div className="erp-label">{" "}</div>
                  <button className="erp-btn" type="button" onClick={() => setShowAdvanced((v) => !v)}>
                    {t("advancedJson")}
                  </button>
                </div>
              </div>

              <div className="mt-1 text-xs text-slate-500">{t("salaryHint")}</div>

              {showAdvanced ? (
                <div className="mt-2">
                  <div className="erp-field">
                    <div className="erp-label">{t("advancedJson")}</div>
                    <textarea
                      className="erp-input"
                      style={{ height: 120, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                      value={salaryJson}
                      onChange={(e) => setSalaryJson(e.target.value)}
                    />
                    <div className="mt-1 text-xs text-slate-500">{t("salaryHelp")}</div>
                  </div>
                  {jsonErr ? <div className="erp-alert erp-alert-danger">{jsonErr}</div> : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-3">
            <div className="erp-card erp-compact-card">
              <div className="erp-card-title">{t("contacts")}</div>

              <div className="mt-2 space-y-2">
                <div className="erp-field">
                  <div className="erp-label">{t("email")}</div>
                  <input className="erp-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={"name@company.com"} />
                </div>

                <div className="erp-field">
                  <div className="erp-label">{t("phone")}</div>
                  <input className="erp-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={"+7 999 111-22-33"} />
                </div>

                <div className="erp-field">
                  <div className="erp-label">{t("person")}</div>
                  <input className="erp-input" value={person} onChange={(e) => setPerson(e.target.value)} placeholder={"Ivan"} />
                </div>
              </div>
            </div>

            {err ? <div className="erp-alert erp-alert-danger">{err}</div> : null}
          </div>
        </div>
      </div>

      <div className="erp-client-edit-footer">
        <div className="erp-client-edit-footer-inner">
          <div className="erp-client-edit-footer-status">
            <span className="text-xs text-slate-500">{saving ? t("saving") : t("saved")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="erp-btn" type="button" onClick={() => nav("/client-profile")} disabled={saving || loading}>
              {t("back")}
            </button>
            <button className="erp-btn" type="button" onClick={() => nav(-1)} disabled={saving || loading}>
              {t("cancel")}
            </button>
            <button className="erp-btn erp-btn-primary" type="button" disabled={saving || loading} onClick={save}>
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
