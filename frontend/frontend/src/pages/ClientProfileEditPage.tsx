import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGetJson, apiPutJson } from "../api";

type ClientProfile = {
  client_code: string;
  id?: string;
  code?: string;
  label?: string;
  name?: string;
  tax_system?: string;
  salary_dates?: any;
  has_tourist_tax?: boolean;
  email?: string;
  phone?: string;
  contact_person?: string;
  settings?: any;
  [k: string]: any;
};

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function pickCode(p?: ClientProfile | null): string {
  if (!p) return "";
  return s(p.client_code || p.code || p.id || "");
}

function pickLabel(p?: ClientProfile | null): string {
  if (!p) return "";
  return s(p.label || p.name || p.client_code || p.code || p.id || "");
}

async function tryGetOne(code: string): Promise<any> {
  const u = "/api/internal/client-profiles/" + encodeURIComponent(code);
  return await apiGetJson(u);
}

export default function ClientProfileEditPage() {
  const params = useParams();
  const nav = useNavigate();
  const clientId = (params as any)?.id as string | undefined;

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<ClientProfile | null>(null);

  const [label, setLabel] = useState<string>("");
  const [taxSystem, setTaxSystem] = useState<string>("");
  const [hasTour, setHasTour] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");

  const headerTitle = useMemo(() => pickLabel(profile) || (clientId ? clientId : ""), [profile, clientId]);

  async function load() {
    if (!clientId) {
      setErr("Missing client id in URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const data = await tryGetOne(clientId);
      const p = (data?.profile ?? data) as ClientProfile;
      const code = pickCode(p) || clientId;

      const norm: ClientProfile = { ...p, client_code: code };
      setProfile(norm);

      setLabel(s(norm.label || norm.name || ""));
      setTaxSystem(s(norm.tax_system || ""));
      setHasTour(Boolean(norm.has_tourist_tax));
      setEmail(s((norm as any).email || ""));
      setPhone(s((norm as any).phone || ""));
      setContactPerson(s((norm as any).contact_person || ""));
    } catch (e: any) {
      setErr(String(e?.message || e || "error"));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function save() {
    if (!clientId) return;
    setSaving(true);
    setErr(null);
    try {
      const payload: any = {
        client_code: clientId,
        label: label.trim() ? label.trim() : undefined,
        tax_system: taxSystem.trim() ? taxSystem.trim() : undefined,
        has_tourist_tax: Boolean(hasTour),
        email: email.trim() ? email.trim() : undefined,
        phone: phone.trim() ? phone.trim() : undefined,
        contact_person: contactPerson.trim() ? contactPerson.trim() : undefined,
      };

      await apiPutJson("/api/internal/client-profiles/" + encodeURIComponent(clientId), payload);

      nav("/client-profile/" + encodeURIComponent(clientId));
    } catch (e: any) {
      setErr(String(e?.message || e || "error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">
            {"\u041f\u0440\u0430\u0432\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430"} {clientId ? `#${clientId}` : ""}
          </div>
          <div className="text-2xl font-semibold text-slate-900 truncate">
            {loading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : headerTitle || "\u2014"}
          </div>
          {err ? <div className="text-sm text-rose-700 mt-1">{err}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => {
              if (!clientId) return;
              nav("/client-profile/" + encodeURIComponent(clientId));
            }}
            type="button"
            disabled={!clientId}
          >
            {"\u041e\u0442\u043c\u0435\u043d\u0430"}
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-60"
            onClick={save}
            type="button"
            disabled={!clientId || loading || saving}
          >
            {saving ? "\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u044e..." : "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">{"\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0435"}</div>
          <div className="text-xs text-slate-500">{clientId ? clientId : ""}</div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">{"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 / \u043c\u0435\u0442\u043a\u0430"}</label>
            <input
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={"\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: IP USN DR"}
              disabled={loading || saving}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">{"\u0420\u0435\u0436\u0438\u043c \u043d\u0430\u043b\u043e\u0433\u043e\u043e\u0431\u043b\u043e\u0436\u0435\u043d\u0438\u044f"}</label>
            <input
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={taxSystem}
              onChange={(e) => setTaxSystem(e.target.value)}
              placeholder={"USN_DR / OSNO_VAT / ..."}
              disabled={loading || saving}
            />
          </div>

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={hasTour}
                onChange={(e) => setHasTour(Boolean(e.target.checked))}
                disabled={loading || saving}
              />
              <span>{"\u041f\u043b\u0430\u0442\u0435\u043b\u044c\u0449\u0438\u043a \u0442\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e \u0441\u0431\u043e\u0440\u0430"}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">{"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b"}</div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">{"\u042d\u043b. \u043f\u043e\u0447\u0442\u0430"}</label>
            <input
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={"mail@example.com"}
              disabled={loading || saving}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">{"\u0422\u0435\u043b\u0435\u0444\u043e\u043d"}</label>
            <input
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={"+7..."}
              disabled={loading || saving}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">{"\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u043d\u043e\u0435 \u043b\u0438\u0446\u043e"}</label>
            <input
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder={"\u0424\u0418\u041e"}
              disabled={loading || saving}
            />
          </div>
        </div>
      </div>

      <details className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <summary className="cursor-pointer select-none px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-900">{"\u0422\u0435\u0445\u043d\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0435"}</div>
          <div className="text-xs text-slate-500">{`\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c JSON`}</div>
        </summary>
        <pre className="p-4 overflow-auto text-xs text-slate-700 whitespace-pre-wrap">
{(() => {
  try { return JSON.stringify(profile, null, 2); } catch { return String(profile); }
})()}
        </pre>
      </details>
    </div>
  );
}
