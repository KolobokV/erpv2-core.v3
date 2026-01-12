import { useEffect, useMemo, useRef, useState } from "react";
import "../../ui/storageUx.css";

type DocItem = {
  id: string;
  filename: string;
  size: number;
  mime?: string;
  client_code?: string | null;
  created_at?: string | null;
};

type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  kind: "system" | "client" | "custom";
  clientCode?: string | null;
};

type DocMeta = {
  folderId?: string;
  note?: string;
};

const LS_FOLDERS = "erpv2_storage_folders_v1";
const LS_DOCMETA = "erpv2_storage_docmeta_v1";

function tFactory() {
  const dict: Record<string, string> = {
    // headings
    kicker: "\u0425\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435",
    titleFiles: "\u0424\u0430\u0439\u043b\u044b",
    titleDocuments: "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b",
    subtitle: "\u041e\u0434\u043d\u043e \u043c\u0435\u0441\u0442\u043e \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0442\u044b \u0441 \u0444\u0430\u0439\u043b\u0430\u043c\u0438: \u043f\u0430\u043f\u043a\u0438, \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430, \u043f\u043e\u0438\u0441\u043a.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    newFolder: "\u041d\u043e\u0432\u0430\u044f \u043f\u0430\u043f\u043a\u0430",
    folders: "\u041f\u0430\u043f\u043a\u0438",
    allDocs: "\u0412\u0441\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b",
    upload: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c",
    choose: "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b\u044b",
    clear: "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c",
    search: "\u041f\u043e\u0438\u0441\u043a...",
    note: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)...",
    client: "\u041a\u043b\u0438\u0435\u043d\u0442",
    statusReady: "\u0413\u043e\u0442\u043e\u0432\u043e",
    statusLoading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    statusUploading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
    emptyTitle: "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432",
    emptySub: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u0444\u0430\u0439\u043b.",
    download: "\u0421\u043a\u0430\u0447\u0430\u0442\u044c",
    del: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c",
    errLoad: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c",
    errUpload: "\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438",
    errDelete: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c",
    folderMine: "\u041c\u043e\u0438 \u043f\u0430\u043f\u043a\u0438",
    folderClient: "\u041f\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u043c",
    hint: "\u041f\u0440\u0438\u043c\u0435\u0440\u044b: PDF, \u0441\u043a\u0430\u043d\u044b, \u0444\u043e\u0442\u043e, \u0442\u0430\u0431\u043b\u0438\u0446\u044b.",
  };
  return (k: string) => dict[k] ?? k;
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

function downloadUrl(id: string) {
  return "/api/internal/documents/" + encodeURIComponent(id) + "/download";
}

function buildSystemFolders(t: (k: string) => string): FolderNode[] {
  return [
    { id: "sys_all", name: t("allDocs"), parentId: null, kind: "system" },
  ];
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v = v / 1024;
    i++;
  }
  const s = i === 0 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  return s + " " + units[i];
}

function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

async function apiGetDocs(client: string): Promise<{ ok: boolean; status: number; items: DocItem[]; rawText?: string }> {
  const q = client.trim() ? "?client=" + encodeURIComponent(client.trim()) : "";
  const resp = await fetch("/api/internal/documents" + q, { method: "GET" });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, items: [], rawText: txt };
  }
  const data = await resp.json().catch(() => null);
  const arr = Array.isArray((data as any)?.items) ? ((data as any).items as DocItem[]) : Array.isArray(data) ? (data as DocItem[]) : [];
  return { ok: true, status: resp.status, items: arr };
}

async function apiUpload(files: File[], clientCode: string): Promise<{ ok: boolean; status: number; items?: DocItem[]; rawText?: string }> {
  const fd = new FormData();
  if (clientCode && clientCode.trim()) fd.append("client_code", clientCode.trim());
  for (const f of files) fd.append("files", f, f.name);
  const resp = await fetch("/api/internal/documents/upload", { method: "POST", body: fd });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, rawText: txt };
  }
  const data = await resp.json().catch(() => null);
  const arr = Array.isArray((data as any)?.items) ? ((data as any).items as DocItem[]) : undefined;
  return { ok: true, status: resp.status, items: arr };
}

async function apiDelete(id: string): Promise<{ ok: boolean; status: number; rawText?: string }> {
  const resp = await fetch("/api/internal/documents/" + encodeURIComponent(id), { method: "DELETE" });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, rawText: txt };
  }
  return { ok: true, status: resp.status };
}

export default function StorageWorkspace(props: { defaultView: "storage" | "documents"; embedded?: boolean }) {
  const t = useMemo(() => tFactory(), []);
  const embedded = !!props.embedded;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string>(t("statusReady"));
  const [err, setErr] = useState<string>("");

  const [customFolders, setCustomFolders] = useState<FolderNode[]>(() => {
    const saved = lsGet<FolderNode[]>(LS_FOLDERS, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [docMeta, setDocMeta] = useState<Record<string, DocMeta>>(() => {
    const saved = lsGet<Record<string, DocMeta>>(LS_DOCMETA, {} as any);
    return saved && typeof saved === "object" ? saved : {};
  });

  const [activeFolderId, setActiveFolderId] = useState<string>("sys_all");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [picked, setPicked] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const systemFolders = useMemo(() => buildSystemFolders(t), [t]);

  const allFolders = useMemo(() => {
    // basic grouping: system + custom only (client folders later)
    return [...systemFolders, ...customFolders];
  }, [systemFolders, customFolders]);

  useEffect(() => {
    lsSet(LS_FOLDERS, customFolders);
  }, [customFolders]);

  useEffect(() => {
    lsSet(LS_DOCMETA, docMeta);
  }, [docMeta]);

  const [itemsAll, setItemsAll] = useState<DocItem[]>([]);

  const itemsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = itemsAll.slice();

    if (clientFilter.trim()) {
      const c = clientFilter.trim();
      arr = arr.filter((x) => (x.client_code || "") === c);
    }

    // folder filtering: only custom folders actually filter by meta.folderId
    if (activeFolderId !== "sys_all") {
      arr = arr.filter((x) => (docMeta[x.id]?.folderId || "") === activeFolderId);
    }

    if (q) {
      arr = arr.filter((x) => (x.filename || "").toLowerCase().includes(q));
    }

    // newest first
    arr.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return arr;
  }, [itemsAll, search, clientFilter, activeFolderId, docMeta]);

  const refresh = async () => {
    setLoading(true);
    setErr("");
    setStatus(t("statusLoading"));
    const res = await apiGetDocs(clientFilter.trim());
    if (!res.ok) {
      setItemsAll([]);
      setErr(t("errLoad") + " (" + String(res.status) + ")");
      setStatus(t("statusReady"));
      setLoading(false);
      return;
    }
    setItemsAll(res.items || []);
    setStatus(t("statusReady"));
    setLoading(false);
  };

  useEffect(() => {
    // auto-load on mount
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files || []);
    setPicked(arr);
  };

  const doUpload = async () => {
    if (picked.length === 0 || uploading) return;
    setUploading(true);
    setErr("");
    setStatus(t("statusUploading"));

    const res = await apiUpload(picked, clientFilter.trim());
    if (!res.ok) {
      setErr(t("errUpload") + " (" + String(res.status) + ")");
      setStatus(t("statusReady"));
      setUploading(false);
      return;
    }

    // if backend returns items, use it; else refresh
    if (Array.isArray(res.items)) {
      setItemsAll(res.items);
    } else {
      await refresh();
    }

    // store note into docMeta for the newest uploaded items (best-effort)
    if (note.trim()) {
      setDocMeta((prev) => {
        const next = { ...prev };
        for (const it of (res.items || [])) {
          next[it.id] = { ...(next[it.id] || {}), note: note.trim() };
        }
        return next;
      });
    }

    setPicked([]);
    setNote("");
    if (inputRef.current) inputRef.current.value = "";
    setStatus(t("statusReady"));
    setUploading(false);
  };

  const doDelete = async (id: string) => {
    // optimistic UI
    setItemsAll((prev) => prev.filter((x) => x.id !== id));
    const res = await apiDelete(id);
    if (!res.ok) {
      // restore by reload (simplest)
      setErr(t("errDelete") + " (" + String(res.status) + ")");
      await refresh();
    }
  };

  const createFolder = () => {
    const name = prompt("Folder name");
    if (!name) return;
    const clean = name.trim();
    if (!clean) return;
    const id = "cust_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
    setCustomFolders((prev) => [{ id, name: clean, parentId: null, kind: "custom" }, ...prev]);
    setActiveFolderId(id);
  };

  const moveToFolder = (docId: string, folderId: string) => {
    setDocMeta((prev) => ({ ...prev, [docId]: { ...(prev[docId] || {}), folderId } }));
  };

  const title = props.defaultView === "documents" ? t("titleDocuments") : t("titleFiles");

  return (
    <div className={"stx-wrap" + (embedded ? " stx-embedded" : "")}>
      {!embedded ? (
        <div className="stx-head">
          <div className="stx-head-left">
            <div className="stx-kicker">{t("kicker")}</div>
            <div className="stx-title">{title}</div>
            <div className="stx-sub">{t("subtitle")}</div>
          </div>
          <div className="stx-head-right">
            <button className="stx-btn" type="button" onClick={refresh} disabled={loading || uploading}>
              {t("refresh")}
            </button>
            <button className="stx-btn" type="button" onClick={createFolder}>
              {t("newFolder")}
            </button>
          </div>
        </div>
      ) : (
        <div className="stx-embedbar">
          <div className="stx-embedtitle">{t("allDocs")}</div>
          <div className="stx-embedactions">
            <button className="stx-btn stx-btn-sm" type="button" onClick={refresh} disabled={loading || uploading}>
              {t("refresh")}
            </button>
          </div>
        </div>
      )}

      <div className="stx-body">
        <aside className="stx-left">
          <div className="stx-panel">
            <div className="stx-panel-title">{t("folders")}</div>
            <div className="stx-folderlist">
              {allFolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={"stx-folder" + (activeFolderId === f.id ? " is-active" : "")}
                  onClick={() => setActiveFolderId(f.id)}
                >
                  <span className="stx-dot" />
                  <span className="stx-folder-name">{f.name}</span>
                </button>
              ))}
              <button className="stx-folder stx-folder-add" type="button" onClick={createFolder}>
                <span className="stx-plus">+</span>
                <span className="stx-folder-name">{t("newFolder")}</span>
              </button>
            </div>
          </div>

          <div className="stx-panel">
            <div className="stx-panel-title">{t("client")}</div>
            <input
              className="stx-input"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              placeholder="demo_client"
              inputMode="text"
            />
          </div>

          <div className="stx-panel">
            <div className="stx-panel-title">Upload</div>
            <textarea className="stx-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} />
            <div className="stx-filebox">
              <input ref={inputRef} className="stx-file" type="file" multiple onChange={(e) => onPickFiles(e.target.files)} />
              {picked.length > 0 ? (
                <div className="stx-picked">
                  {picked.slice(0, 3).map((f) => (
                    <div key={f.name} className="stx-picked-row">
                      <span className="stx-picked-name">{f.name}</span>
                      <span className="stx-pill">{fmtBytes(f.size)}</span>
                    </div>
                  ))}
                  {picked.length > 3 ? <div className="stx-picked-more">+{picked.length - 3}</div> : null}
                </div>
              ) : (
                <div className="stx-hint">{t("hint")}</div>
              )}
            </div>
            <div className="stx-actions">
              <button className="stx-btn stx-btn-primary" type="button" onClick={doUpload} disabled={picked.length === 0 || uploading}>
                {t("upload")}
              </button>
              <button
                className="stx-btn"
                type="button"
                onClick={() => {
                  setPicked([]);
                  setNote("");
                  if (inputRef.current) inputRef.current.value = "";
                }}
                disabled={uploading}
              >
                {t("clear")}
              </button>
            </div>
            <div className="stx-status">
              <span className={"stx-badge" + (err ? " is-bad" : "")}>{err ? err : status}</span>
            </div>
          </div>
        </aside>

        <main className="stx-right">
          <div className="stx-toolbar">
            <input className="stx-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} />
            <div className="stx-count">{itemsFiltered.length}</div>
          </div>

          {itemsFiltered.length === 0 ? (
            <div className="stx-empty">
              <div className="stx-empty-title">{t("emptyTitle")}</div>
              <div className="stx-empty-sub">{t("emptySub")}</div>
              <button className="stx-btn stx-btn-primary" type="button" onClick={() => inputRef.current?.click()}>
                {t("choose")}
              </button>
            </div>
          ) : (
            <div className="stx-list">
              {itemsFiltered.map((it) => {
                const meta = docMeta[it.id] || {};
                return (
                  <div key={it.id} className="stx-row">
                    <div className="stx-row-main">
                      <div className="stx-filename">{it.filename}</div>
                      <div className="stx-row-sub">
                        <span className="stx-pill">{fmtBytes(it.size || 0)}</span>
                        {it.created_at ? <span className="stx-pill">{fmtDate(it.created_at)}</span> : null}
                        {it.client_code ? <span className="stx-pill">{String(it.client_code)}</span> : null}
                        {meta.folderId && meta.folderId !== "sys_all" ? (
                          <span className="stx-pill stx-pill-dim">{allFolders.find((f) => f.id === meta.folderId)?.name || meta.folderId}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="stx-row-actions">
                      <a className="stx-btn stx-btn-sm" href={downloadUrl(it.id)}>
                        {t("download")}
                      </a>
                      <button className="stx-btn stx-btn-sm stx-btn-danger" type="button" onClick={() => doDelete(it.id)}>
                        {t("del")}
                      </button>
                      <select
                        className="stx-select"
                        value={meta.folderId || "sys_all"}
                        onChange={(e) => moveToFolder(it.id, e.target.value)}
                        title="folder"
                      >
                        <option value="sys_all">{t("allDocs")}</option>
                        {customFolders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
