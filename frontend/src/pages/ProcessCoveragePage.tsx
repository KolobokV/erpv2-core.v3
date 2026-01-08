import { useEffect, useMemo, useState } from "react";
import { apiGetJson } from "../api";

type AnyJson = any;

type FetchState = {
  loading: boolean;
  ok: boolean;
  error?: string;
  data?: AnyJson;
};

function normalizeList(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

type CoverageRow = {
  client: string;
  key: string;
  count: number;
};

const S_TITLE = "\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435";
const S_SUB = "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u0435 \u043f\u043e \u0438\u043d\u0441\u0442\u0430\u043d\u0441\u0430\u043c \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432. \u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0434\u0430\u043d\u043d\u044b\u0445 \u2014 \u0442\u043e\u0442 \u0436\u0435, \u0447\u0442\u043e \u0438 \u0432 \u0440\u0430\u0437\u0434\u0435\u043b\u0435 \u00ab\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b\u00bb.";
const S_ENDPOINT = "\u042d\u043d\u0434\u043f\u043e\u0438\u043d\u0442";
const S_RELOAD = "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c";
const S_LOADING = "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...";
const S_ERROR = "\u041e\u0448\u0438\u0431\u043a\u0430";
const S_EMPTY = "\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445";
const S_CLIENT = "\u041a\u043b\u0438\u0435\u043d\u0442";
const S_PROCESS = "\u041f\u0440\u043e\u0446\u0435\u0441\u0441";
const S_COUNT = "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e";
const S_RAW = "\u0421\u044b\u0440\u043e\u0439 \u043e\u0442\u0432\u0435\u0442";
const S_HINT_TITLE = "\u041f\u043e\u0447\u0435\u043c\u0443 \u043f\u0443\u0441\u0442\u043e";
const S_HINT_TEXT = "\u042d\u0442\u043e\u0442 \u0440\u0430\u0437\u0434\u0435\u043b \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u043d\u0430 \u0438\u043d\u0441\u0442\u0430\u043d\u0441\u0430\u0445 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432. \u0415\u0441\u043b\u0438 \u0438\u043d\u0441\u0442\u0430\u043d\u0441\u043e\u0432 \u043d\u0435\u0442 \u2014 \u043d\u0443\u0436\u043d\u043e \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0438\u0445 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044e \u0432 backend (materialize/derive) \u0438 \u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432 \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u043c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435.";

export default function ProcessCoveragePage() {
  const endpoint = "/api/internal/process-instances-v2";
  const [state, setState] = useState<FetchState>({ loading: false, ok: false });

  async function load() {
    setState({ loading: true, ok: false });
    try {
      const data = await apiGetJson(endpoint);
      setState({ loading: false, ok: true, data });
    } catch (e: any) {
      setState({ loading: false, ok: false, error: e?.message || String(e) });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useMemo(() => normalizeList(state.data), [state.data]);

  const rows: CoverageRow[] = useMemo(() => {
    const map = new Map<string, CoverageRow>();
    for (const it of list) {
      const client = String(it?.client_label || it?.client_code || it?.client_id || "-");
      const key = String(it?.instance_key || it?.key || it?.name || "-");
      const k = client + "||" + key;
      const cur = map.get(k);
      if (cur) cur.count += 1;
      else map.set(k, { client, key, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.client === b.client) return a.key.localeCompare(b.key);
      return a.client.localeCompare(b.client);
    });
  }, [list]);

  const isEmpty = !state.loading && state.ok && list.length === 0;

  return (
    <div className="process-coverage-page" style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{S_TITLE}</h1>
          <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>{S_SUB}</div>
        </div>
        <button onClick={load} disabled={state.loading} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(255,255,255,0.6)" }}>
          {S_RELOAD}
        </button>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, alignItems: "center" }}>
          <div>
            <span style={{ opacity: 0.7 }}>{S_ENDPOINT}:</span> <code>{endpoint}</code>
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>{S_COUNT}:</span> <b>{state.ok ? String(list.length) : "-"}</b>
          </div>
          {state.loading && <div style={{ opacity: 0.85 }}>{S_LOADING}</div>}
          {!state.loading && state.error && (
            <div style={{ color: "rgba(180,0,0,0.85)" }}>
              <b>{S_ERROR}:</b> {state.error}
            </div>
          )}
        </div>

        {isEmpty && (
          <div style={{ marginTop: 12, border: "1px dashed #ccc", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{S_HINT_TITLE}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{S_HINT_TEXT}</div>
          </div>
        )}

        {!state.loading && state.ok && list.length > 0 && (
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "6px 8px" }}>{S_CLIENT}</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "6px 8px" }}>{S_PROCESS}</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "6px 8px" }}>{S_COUNT}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.client + "||" + r.key}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.client}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{r.key}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3", textAlign: "right" }}>{r.count}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "10px 8px", opacity: 0.8 }}>{S_EMPTY}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {rows.length > 300 && (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                {"\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0435\u0440\u0432\u044b\u0435 300 \u0441\u0442\u0440\u043e\u043a."}
              </div>
            )}
          </div>
        )}

        {!state.loading && state.ok && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer" }}>{S_RAW}</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
              {JSON.stringify(state.data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
