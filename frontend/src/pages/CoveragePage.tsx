import { useEffect, useMemo, useState } from "react";

type AnyJson = any;

type FetchResult = {
  ok: boolean;
  url: string;
  status?: number;
  data?: AnyJson;
  error?: string;
};

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: ctrl.signal
    });
    const status = r.status;
    const text = await r.text();
    let data: AnyJson = undefined;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: r.ok, url, status, data };
  } catch (e: any) {
    const msg = (e && e.name === "AbortError") ? "\u0054\u0069\u006d\u0065\u006f\u0075\u0074" : (e?.message || String(e));
    return { ok: false, url, error: msg };
  } finally {
    window.clearTimeout(t);
  }
}

const S_TITLE = "\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435 \u0438 \u0440\u0438\u0441\u043a\u0438";
const S_SUB = "\u042d\u0442\u043e\u0442 \u044d\u043a\u0440\u0430\u043d \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u043f\u043e \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430\u043c. \u0421\u0435\u0439\u0447\u0430\u0441 \u043c\u044b \u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u0440\u0443\u0435\u043c, \u043a\u0430\u043a\u0438\u0435 \u044d\u043d\u0434\u043f\u043e\u0438\u043d\u0442\u044b backend \u043e\u0442\u0434\u0430\u044e\u0442 \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u0435/\u0440\u0438\u0441\u043a\u0438.";
const S_BTN_RELOAD = "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c";
const S_BTN_RETRY = "\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0443 API";
const S_SECTION_API = "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 API";
const S_SECTION_DATA = "\u0414\u0430\u043d\u043d\u044b\u0435";
const S_STATUS_WAIT = "\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c...";
const S_STATUS_OK = "\u041d\u0430\u0439\u0434\u0435\u043d \u0440\u0430\u0431\u043e\u0447\u0438\u0439 \u044d\u043d\u0434\u043f\u043e\u0438\u043d\u0442";
const S_STATUS_FAIL = "\u0420\u0430\u0431\u043e\u0447\u0438\u0439 \u044d\u043d\u0434\u043f\u043e\u0438\u043d\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d";
const S_HINT_FAIL = "\u041f\u043e\u0441\u043b\u0435 \u043e\u0447\u0438\u0441\u0442\u043a\u0438 \u043f\u0440\u043e\u0435\u043a\u0442\u0430 \u0441\u0442\u0430\u0440\u044b\u0435 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0435 \u043f\u043e\u0434\u0445\u0432\u0430\u0442\u044b\u0432\u0430\u044e\u0442\u0441\u044f. \u0415\u0441\u043b\u0438 \u043d\u0443\u0436\u043d\u043e, \u043c\u044b \u0434\u043e\u0431\u0430\u0432\u0438\u043c \u044f\u0432\u043d\u0443\u044e \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044e \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u044f \u0432 backend \u0438 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0437\u0434\u0435\u0441\u044c.";
const S_RAW = "\u0421\u044b\u0440\u043e\u0439 \u043e\u0442\u0432\u0435\u0442";
const S_ENDPOINTS = "\u041f\u0440\u043e\u0431\u0443\u0435\u043c \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0432\u0430\u0440\u0438\u0430\u043d\u0442\u043e\u0432 (\u043f\u043e\u0440\u044f\u0434\u043e\u043a \u0432\u0430\u0436\u0435\u043d)";
const S_USED = "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f";
const S_NOT_USED = "\u041d\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442\u0441\u044f";
const S_HTTP = "HTTP";
const S_ERROR = "\u041e\u0448\u0438\u0431\u043a\u0430";
const S_EMPTY = "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f";
const S_NOTE = "\u0417\u0430\u043c\u0435\u0442\u043a\u0430";
const S_NOTE_TEXT = "\u042d\u0442\u043e \u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u044d\u043a\u0440\u0430\u043d. \u041e\u043d \u043d\u0435 \u043c\u0435\u043d\u044f\u0435\u0442 \u043b\u043e\u0433\u0438\u043a\u0443 \u0437\u0430\u0434\u0430\u0447 \u0438 \u0440\u0435\u0433\u043b\u0430\u043c\u0435\u043d\u0442\u0430, \u0430 \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u043d\u0430\u0439\u0442\u0438 \u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0439 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u043f\u043e\u043a\u0440\u044b\u0442\u0438\u044f.";

export default function CoveragePage() {
  const endpoints = useMemo(() => ([
    "/api/coverage",
    "/api/coverage/summary",
    "/api/coverage/status",
    "/api/internal/coverage",
    "/api/internal/coverage/summary",
    "/api/internal/risk",
    "/api/internal/risks",
    "/api/risk",
    "/api/risks",
    "/api/control-events/coverage",
  ]), []);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FetchResult[]>([]);
  const [chosen, setChosen] = useState<FetchResult | null>(null);

  async function runScan() {
    setLoading(true);
    setChosen(null);
    const out: FetchResult[] = [];
    for (const url of endpoints) {
      const r = await fetchJsonWithTimeout(url, 6000);
      out.push(r);
      if (r.ok) {
        setChosen(r);
        break;
      }
    }
    setResults(out);
    setLoading(false);
  }

  useEffect(() => { runScan(); }, []);

  const statusLabel = loading ? S_STATUS_WAIT : (chosen ? S_STATUS_OK : S_STATUS_FAIL);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>{S_TITLE}</h1>
        <button onClick={() => window.location.reload()} style={{ padding: "6px 10px" }}>
          {S_BTN_RELOAD}
        </button>
      </div>

      <p style={{ marginTop: 8, marginBottom: 16, opacity: 0.85 }}>{S_SUB}</p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button disabled={loading} onClick={runScan} style={{ padding: "8px 12px" }}>
          {S_BTN_RETRY}
        </button>
        <span style={{ fontWeight: 600 }}>{statusLabel}</span>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{S_SECTION_API}</div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>{S_ENDPOINTS}</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "6px 8px" }}>URL</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "6px 8px" }}>{S_HTTP}</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "6px 8px" }}>{S_USED}</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "6px 8px" }}>{S_ERROR}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.url}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3", whiteSpace: "nowrap" }}>{r.url}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>{typeof r.status === "number" ? r.status : ""}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3" }}>
                    {chosen?.url === r.url ? S_USED : S_NOT_USED}
                  </td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f3f3", opacity: 0.9 }}>
                    {r.ok ? "" : (r.error ? r.error : "")}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "10px 8px", opacity: 0.8 }}>{S_EMPTY}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && !chosen && (
          <div style={{ marginTop: 10, padding: 10, border: "1px dashed #ccc", borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{S_NOTE}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{S_HINT_FAIL}</div>
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{S_SECTION_DATA}</div>

        {chosen ? (
          <div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              URL: <code>{chosen.url}</code>
            </div>
            <details>
              <summary style={{ cursor: "pointer" }}>{S_RAW}</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>
                {JSON.stringify(chosen.data, null, 2)}
              </pre>
            </details>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>{S_NOTE_TEXT}</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.85 }}>{S_EMPTY}</div>
        )}
      </div>
    </div>
  );
}