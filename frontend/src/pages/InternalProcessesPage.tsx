import { useEffect, useMemo, useState } from "react";
import { apiGetJson } from "../api";

type AnyJson = any;

type FetchState = {
  loading: boolean;
  ok: boolean;
  status?: number;
  error?: string;
  data?: AnyJson;
};

function normalizeList(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

const S_TITLE = "\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b";
const S_SUB = "\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u044b (\u0438\u043d\u0441\u0442\u0430\u043d\u0441\u044b). \u0415\u0441\u043b\u0438 \u0434\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0442, \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442 backend \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435 \u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0435\u0442 \u0438\u043b\u0438 \u043d\u0435 \u0445\u0440\u0430\u043d\u0438\u0442 \u0438\u043d\u0441\u0442\u0430\u043d\u0441\u044b \u043f\u0440\u043e\u0446\u0435\u0441\u0441\u043e\u0432.";
const S_ENDPOINT = "\u042d\u043d\u0434\u043f\u043e\u0438\u043d\u0442";
const S_RELOAD = "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c";
const S_LOADING = "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...";
const S_ERROR = "\u041e\u0448\u0438\u0431\u043a\u0430";
const S_EMPTY = "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445";
const S_COUNT = "\u041a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e";
const S_RAW = "\u0421\u044b\u0440\u043e\u0439 \u043e\u0442\u0432\u0435\u0442";
const S_HINT_TITLE = "\u041f\u043e\u0447\u0435\u043c\u0443 \u043f\u0443\u0441\u0442\u043e";
const S_HINT_TEXT = "\u041f\u043e\u0441\u043b\u0435 \u043e\u0447\u0438\u0441\u0442\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u043c\u044b \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043f\u043e\u0434\u0445\u0432\u0430\u0442\u044b\u0432\u0430\u0435\u043c \u0441\u0442\u0430\u0440\u044b\u0435 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u0444\u0430\u0439\u043b\u044b. \u0415\u0441\u043b\u0438 \u044d\u0442\u043e\u0442 \u0440\u0430\u0437\u0434\u0435\u043b \u0434\u043e\u043b\u0436\u0435\u043d \u0436\u0438\u0442\u044c, \u043d\u0443\u0436\u043d\u043e \u044f\u0432\u043d\u043e \u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0438\u043d\u0441\u0442\u0430\u043d\u0441\u044b \u0432 backend (materialize/derive) \u0438 \u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0445 \u0432 \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e\u043c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435.";

export default function InternalProcessesPage() {
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
  const isEmpty = !state.loading && state.ok && list.length === 0;

  return (
    <div className="internal-processes-page" style={{ padding: 24, maxWidth: 1100 }}>
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
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {list.slice(0, 200).map((it: any, idx: number) => (
              <div key={(it?.id || it?.instance_key || idx) + ""} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {it?.label || it?.name || it?.instance_key || it?.key || "\u041f\u0440\u043e\u0446\u0435\u0441\u0441"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  <span style={{ opacity: 0.7 }}>id:</span> {String(it?.id || "-")} {"  "}
                  <span style={{ opacity: 0.7 }}>status:</span> {String(it?.status || "-")} {"  "}
                  <span style={{ opacity: 0.7 }}>client:</span> {String(it?.client_code || it?.client_id || "-")}
                </div>
              </div>
            ))}
            {list.length > 200 && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {"\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0435\u0440\u0432\u044b\u0435 200 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u043e\u0432."}
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

        {!state.loading && !state.ok && !state.error && (
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>{S_EMPTY}</div>
        )}
      </div>
    </div>
  );
}
