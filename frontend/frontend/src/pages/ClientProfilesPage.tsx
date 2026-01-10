import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGetJson } from "../api";

type ClientProfile = {
  client_code?: string;
  id?: string;
  code?: string;
  label?: string;
  name?: string;
  tax_system?: string;
  has_tourist_tax?: boolean;
  email?: string;
  phone?: string;
  contact_person?: string;
  [k: string]: any;
};

function s(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function pickCode(x: ClientProfile): string {
  return s(x.client_code || x.code || x.id || "");
}

function pickLabel(x: ClientProfile): string {
  return s(x.label || x.name || x.client_code || x.code || x.id || "");
}

async function tryGetList(): Promise<any> {
  const urls = ["/api/internal/client-profiles", "/api/internal/client-profiles/"];
  let lastErr: any = null;
  for (const u of urls) {
    try {
      return await apiGetJson(u);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export default function ClientProfilesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const data = await tryGetList();
      const arr = (data?.items ?? data?.profiles ?? data) as any;
      const list = Array.isArray(arr) ? (arr as ClientProfile[]) : [];
      setItems(list);
    } catch (e: any) {
      setErr(String(e?.message || e || "error"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((x) => {
      const hay = `${pickCode(x)} ${pickLabel(x)} ${s(x.tax_system)} ${s(x.email)} ${s(x.phone)} ${s(x.contact_person)}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-2xl font-semibold text-slate-900 truncate">{"\u041a\u043b\u0438\u0435\u043d\u0442\u044b"}</div>
          <div className="text-xs text-slate-500">
            {loading ? "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..." : `\u0412\u0441\u0435\u0433\u043e: ${filtered.length}`}
          </div>
          {err ? <div className="text-sm text-rose-700 mt-1">{err}</div> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-white text-slate-900 text-sm ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={reload}
            type="button"
          >
            {"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-3 md:p-4">
        <input
          className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={"\u041f\u043e\u0438\u0441\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u2026"}
        />
      </div>

      {loading ? (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-4 text-sm text-slate-600">
          {"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430..."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 p-4 text-sm text-slate-600">
          {"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {filtered.slice(0, 60).map((c) => {
            const code = pickCode(c);
            const title = pickLabel(c);
            return (
              <button
                key={code || title}
                type="button"
                className="text-left rounded-xl bg-white shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow p-4"
                onClick={() => {
                  if (!code) return;
                  nav("/client-profile/" + encodeURIComponent(code));
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{title || "\u2014"}</div>
                    <div className="text-xs text-slate-500 truncate">{code || "\u2014"}</div>
                  </div>
                  {c.has_tourist_tax ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                      {"\u0422\u0443\u0440.\u0441\u0431\u043e\u0440"}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                      {"\u041e\u0431\u044b\u0447\u043d\u044b\u0439"}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-1">
                  <div className="text-xs text-slate-600 truncate">
                    {"\u0420\u0435\u0436\u0438\u043c: "} <span className="text-slate-900">{s(c.tax_system) || "\u2014"}</span>
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    {"\u041a\u043e\u043d\u0442\u0430\u043a\u0442: "} <span className="text-slate-900">{s(c.contact_person) || "\u2014"}</span>
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    {"\u0422\u0435\u043b: "} <span className="text-slate-900">{s(c.phone) || "\u2014"}</span>
                  </div>
                  <div className="text-xs text-slate-600 truncate">
                    {"\u041f\u043e\u0447\u0442\u0430: "} <span className="text-slate-900">{s(c.email) || "\u2014"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
