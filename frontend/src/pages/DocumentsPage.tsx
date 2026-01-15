import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import StorageWorkspace from "../components/storage/StorageWorkspace";
import { t } from "../i18n/t";
import "../ux/docsClientBar.css";

const LS_KEY = "erp_docs_client";

export default function DocumentsPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();

  const client = useMemo(() => {
    const q = sp.get("client");
    return q && q.trim().length > 0 ? q.trim() : "";
  }, [sp]);

  useEffect(() => {
    if (client) {
      try { localStorage.setItem(LS_KEY, client); } catch {}
    }
  }, [client]);

  const current = (() => {
    try { return localStorage.getItem(LS_KEY) || ""; } catch { return ""; }
  })();

  const clear = () => {
    try { localStorage.removeItem(LS_KEY); } catch {}
    nav("/documents");
  };

  return (
    <div className="docs-page">
      <div className="docs-clientbar">
        <div className="docs-clientbar-left">
          <div className="docs-clientbar-title">{t("docs.clientDocsTitle")}</div>
          <div className="docs-clientbar-sub">
            {current ? t("docs.clientSelected", { id: current }) : t("docs.clientAll")}
          </div>
        </div>
        <div className="docs-clientbar-right">
          {current ? (
            <button className="docs-clientbar-btn" onClick={clear}>
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </div>

      <StorageWorkspace defaultView="documents" />
    </div>
  );
}
