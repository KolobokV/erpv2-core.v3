import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGetJson, apiPutJson } from "../api";

type ClientProfile = {
  client_code: string;
  code?: string;
  id?: string;
  label?: string;
  profile_type?: string;
  tax_system?: string;
  salary_dates?: any;
  has_tourist_tax?: boolean;
  contact_email?: string;
  contact_phone?: string;
  contact_person?: string;
  settings?: any;
  [k: string]: any;
};

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function t(key: string): string {
  const dict: Record<string, string> = {
    title: "\u041f\u0440\u0430\u0432\u043a\u0430 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438",
    back: "\u041d\u0430\u0437\u0430\u0434",
    save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
    saving: "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e...",
    taxSystem: "\u0420\u0435\u0436\u0438\u043c \u043d\u0430\u043b\u043e\u0433\u043e\u043e\u0431\u043b\u043e\u0436\u0435\u043d\u0438\u044f",
    touristTax: "\u041f\u043b\u0430\u0442\u0435\u043b\u044c\u0449\u0438\u043a \u0442\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e \u0441\u0431\u043e\u0440\u0430",
    salaryDates: "\u0414\u0430\u0442\u044b \u0437\u0430\u0440\u043f\u043b\u0430\u0442\u044b (JSON)",
    contacts: "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b",
    email: "\u042d\u043b.\u043f\u043e\u0447\u0442\u0430",
    phone: "\u0422\u0435\u043b\u0435\u0444\u043e\u043d",
    person: "\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e",
    errLoad: "\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438",
    errSave: "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f",
  };
  return dict[key] || key;
}

function parseJsonOrEmptyObject(v: string): any {
  const s0 = (v || "").trim();
  if (!s0) return {};
  try {
    return JSON.parse(s0);
  } catch {
    return null;
  }
}

export default function ClientProfileEditPage() {
  const params = useParams();
  const navigate = useNavigate();
  const clientCode = (params as any)?.id as string | undefined;

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [taxSystem, setTaxSystem] = useState("");
  const [hasTouristTax, setHasTouristTax] = useState(false);
  const [salaryDatesJson, setSalaryDatesJson] = useState("{}");

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  const [saveBusy, setSaveBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const headline = useMemo(() => {
    if (!profile) return clientCode ? clientCode : "\u2014";
    return s(profile.label || profile.client_code || profile.code || profile.id || clientCode || "\u2014");
  }, [profile, clientCode]);

  const prettyJson = useMemo(() => {
    try {
      return JSON.stringify(profile, null, 2);
    } catch {
      return String(profile);
    }
  }, [profile]);


  useEffect(() => {
    let alive = true;

    async function load() {
      if (!clientCode) {
        setErr("Missing client code in URL.");
        setLoading(false);
        return;
      }

      setErr(null);
      setLoading(true);
      try {
        const p = await apiGetJson(`/api/internal/client-profiles/${encodeURIComponent(clientCode)}`);
        if (!alive) return;

        const prof = (p?.profile ?? p) as ClientProfile;
        setProfile(prof || null);

        setTaxSystem(s(prof?.tax_system || ""));
        setHasTouristTax(Boolean(prof?.has_tourist_tax));
        setSalaryDatesJson(() => {
          try {
            return JSON.stringify(prof?.salary_dates ?? {}, null, 2);
          } catch {
            return "{}";
          }
        });

        setContactEmail(s(prof?.contact_email || prof?.settings?.contact_email || ""));
        setContactPhone(s(prof?.contact_phone || prof?.settings?.contact_phone || ""));
        setContactPerson(s(prof?.contact_person || prof?.settings?.contact_person || ""));
      } catch (e: any) {
        if (!alive) return;
        setErr(t("errLoad") + ": " + String(e?.message || e || "error"));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [clientCode]);

  async function onSave() {
    if (!clientCode) return;
    setErr(null);

    const sd = parseJsonOrEmptyObject(salaryDatesJson);
    if (sd === null) {
      setErr("salary_dates JSON parse error.");
      return;
    }

    setSaveBusy(true);
    try {
      const payload: any = {
        client_code: clientCode,
        tax_system: taxSystem.trim() || "",
        has_tourist_tax: Boolean(hasTouristTax),
        salary_dates: sd,
        contact_email: contactEmail.trim() || "",
        contact_phone: contactPhone.trim() || "",
        contact_person: contactPerson.trim() || "",
      };

      const saved = await apiPutJson(`/api/internal/client-profiles/${encodeURIComponent(clientCode)}`, payload);
      const prof = (saved?.profile ?? saved) as ClientProfile;

      setProfile(prof || null);
      navigate(`/client-profile/${encodeURIComponent(clientCode)}`);
    } catch (e: any) {
      setErr(t("errSave") + ": " + String(e?.message || e || "error"));
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            {t("title")} {clientCode ? `#${clientCode}` : ""}
          </div>
          <div className="text-2xl font-semibold text-slate-900 truncate">{loading ? "\u2026" : headline}</div>
          {err ? <div className="text-sm text-rose-700 mt-1">{err}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            type="button"
            onClick={() => navigate(`/client-profile/${encodeURIComponent(clientCode || "")}`)}
          >
            {t("back")}
          </button>

          <button
            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
            type="button"
            disabled={saveBusy || !clientCode}
            onClick={onSave}
          >
            {saveBusy ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{t("taxSystem")}</div>
            </div>
            <div className="p-4">
              <input
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                value={taxSystem}
                onChange={(e) => setTaxSystem(e.target.value)}
                placeholder="USN_DR / OSNO_NDS / ..."
              />
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-800 select-none">
                <input type="checkbox" checked={hasTouristTax} onChange={(e) => setHasTouristTax(e.target.checked)} />
                <span>{t("touristTax")}</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{t("salaryDates")}</div>
              <div className="text-xs text-slate-500 mt-1">{"Example: { \"salary_1\": 10, \"salary_2\": 25 }"}</div>
            </div>
            <div className="p-4">
              <textarea
                className="w-full min-h-[140px] px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 font-mono text-xs"
                value={salaryDatesJson}
                onChange={(e) => setSalaryDatesJson(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 md:space-y-6">
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{t("contacts")}</div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("email")}</label>
                <input
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("phone")}</label>
                <input
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+79990001122"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">{t("person")}</label>
                <input
                  className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Ivan Petrov"
                />
              </div>
            </div>
          </div>

          <details className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <summary className="cursor-pointer select-none px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="font-semibold text-slate-900">{"JSON"}</div>
              <div className="text-xs text-slate-500">{"view"}</div>
            </summary>
            <pre className="p-4 overflow-auto text-xs text-slate-700 whitespace-pre-wrap">
              {prettyJson}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
