import { useEffect, useMemo, useRef, useState } from "react";
import "../../ui/storageUx.css";
import "../../ui/storageWorkspaceFileManager.css";

type DocItem = {
  id: string;
  filename: string;
  size: number;
  mime?: string;
  client_code?: string | null;
  created_at: string;
};

type FolderNode = {
  id: string;
  name: string;
  parentId?: string | null;
  kind: "system" | "client" | "custom";
};

type ApiDoc = {
  id: string;
  filename: string;
  size: number;
  mime?: string | null;
  client_code?: string | null;
  created_at: string;
};

type ApiFolder = {
  id: string;
  name: string;
  parent_id?: string | null;
  kind?: string | null;
};

type ApiListResponse = {
  ok?: boolean;
  items?: ApiDoc[];
  folders?: ApiFolder[];
};

const dict: Record<string, string> = {
  kicker: "\u0425\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435",
  title: "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b",
  lead: "\u041e\u0434\u043d\u043e \u043c\u0435\u0441\u0442\u043e \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0442\u044b \u0441 \u0444\u0430\u0439\u043b\u0430\u043c\u0438: \u043f\u0430\u043f\u043a\u0438, \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0430, \u043f\u043e\u0438\u0441\u043a.",
  refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
  newFolder: "\u041d\u043e\u0432\u0430\u044f \u043f\u0430\u043f\u043a\u0430",
  folders: "\u041f\u0430\u043f\u043a\u0438",
  allDocs: "\u0412\u0441\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b",
  byClient: "\u041f\u043e \u043a\u043b\u0438\u0435\u043d\u0442\u0430\u043c",
  myFolders: "\u041c\u043e\u0438 \u043f\u0430\u043f\u043a\u0438",
  search: "\u041f\u043e\u0438\u0441\u043a...",
  upload: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c",
  chooseFiles: "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b\u044b",
  client: "\u041a\u043b\u0438\u0435\u043d\u0442",
  note: "\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e)",
  dropTitle: "\u041f\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0444\u0430\u0439\u043b\u044b \u0441\u044e\u0434\u0430",
  dropSub: "\u0438\u043b\u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0444\u0430\u0439\u043b\u044b",
  selected: "\u0412\u044b\u0431\u0440\u0430\u043d\u043e",
  file: "\u0424\u0430\u0439\u043b",
  size: "\u0420\u0430\u0437\u043c\u0435\u0440",
  created: "\u0421\u043e\u0437\u0434\u0430\u043d",
  download: "\u0421\u043a\u0430\u0447\u0430\u0442\u044c",
  remove: "\u0423\u0434\u0430\u043b\u0438\u0442\u044c",
  emptyTitle: "\u041d\u0435\u0442 \u0444\u0430\u0439\u043b\u043e\u0432",
  emptyBody: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0444\u0430\u0439\u043b \u0438\u043b\u0438 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044e \u043f\u0430\u043f\u043a\u0443.",
  apiOffTitle: "\u0410\u041f\u0418 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e",
  apiOffBody: "\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0431\u044d\u043a\u044d\u043d\u0434 \u0438 \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c.",
  uploading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
  ready: "\u0413\u043e\u0442\u043e\u0432\u043e",
};

function t(k: string): string {
  return dict[k] ?? k;
}

function fmtSize(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const s = i === 0 ? String(Math.floor(v)) : v.toFixed(1);
  return s + " " + units[i];
}

function downloadUrl(id: string): string {
  return "/api/internal/documents/" + encodeURIComponent(id) + "/download";
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toFolderNodes(apiFolders: ApiFolder[] | undefined): FolderNode[] {
  const list = Array.isArray(apiFolders) ? apiFolders : [];
  const out: FolderNode[] = [];
  for (const f of list) {
    const id = safeStr(f.id);
    if (!id) continue;
    out.push({
      id,
      name: safeStr(f.name) || id,
      parentId: f.parent_id ? safeStr(f.parent_id) : null,
      kind: (f.kind === "client" || f.kind === "custom" || f.kind === "system" ? (f.kind as any) : "custom") as FolderNode["kind"],
    });
  }
  return out;
}

export default function StorageWorkspace() {
  const [apiOk, setApiOk] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");
  const [activeFolderId, setActiveFolderId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [clientCode, setClientCode] = useState<string>("demo_client");
  const [note, setNote] = useState<string>("");
  const [items, setItems] = useState<DocItem[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeFolder = useMemo(() => {
    return folders.find((f) => f.id === activeFolderId) ?? null;
  }, [folders, activeFolderId]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = items;

    if (activeFolderId !== "all") {
      // current backend v1: folder filtering is optional; when absent we still show everything
      // future: backend will return folder_id on item
      arr = arr;
    }

    if (q) {
      arr = arr.filter((d) => d.filename.toLowerCase().includes(q) || (d.client_code ?? "").toLowerCase().includes(q));
    }
    return [...arr].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [items, search, activeFolderId]);

  async function apiList() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/internal/documents", { method: "GET" });
      if (!r.ok) {
        setApiOk(false);
        setItems([]);
        setFolders(seedFolders());
        return;
      }
      const j = (await r.json()) as ApiListResponse;
      const apiItems = Array.isArray(j.items) ? j.items : [];
      const next: DocItem[] = apiItems.map((x) => ({
        id: safeStr(x.id),
        filename: safeStr(x.filename),
        size: Number(x.size) || 0,
        mime: x.mime ? safeStr(x.mime) : undefined,
        client_code: x.client_code == null ? null : safeStr(x.client_code),
        created_at: safeStr(x.created_at),
      }));
      setItems(next);
      setFolders(mergeFolders(toFolderNodes(j.folders)));
      setApiOk(true);
    } catch (e: any) {
      setApiOk(false);
      setErr(String(e?.message || e));
      setItems([]);
      setFolders(seedFolders());
    } finally {
      setLoading(false);
    }
  }

  function seedFolders(): FolderNode[] {
    return [
      { id: "all", name: t("allDocs"), parentId: null, kind: "system" },
      { id: "sys_clients", name: t("byClient"), parentId: null, kind: "system" },
      { id: "sys_custom", name: t("myFolders"), parentId: null, kind: "system" },
    ];
  }

  function mergeFolders(apiNodes: FolderNode[]): FolderNode[] {
    const base = seedFolders();
    const seen = new Set<string>(base.map((x) => x.id));
    for (const n of apiNodes) {
      if (!n.id || seen.has(n.id)) continue;
      seen.add(n.id);
      base.push(n);
    }
    return base;
  }

  async function apiUpload(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      fd.append("client_code", clientCode.trim());
      fd.append("note", note.trim());
      fd.append("folder_id", activeFolderId === "all" ? "" : activeFolderId);

      const r = await fetch("/api/internal/documents/upload", { method: "POST", body: fd });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error("upload failed: " + r.status + " " + txt);
      }
      setSelectedFiles([]);
      setNote("");
      await apiList();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function apiDelete(id: string) {
    if (!id) return;
    setErr("");
    try {
      const r = await fetch("/api/internal/documents/" + encodeURIComponent(id), { method: "DELETE" });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error("delete failed: " + r.status + " " + txt);
      }
      await apiList();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function apiCreateFolder() {
    const name = window.prompt("Folder name");
    if (!name) return;
    setErr("");
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("parent_id", "");
      const r = await fetch("/api/internal/documents/folders", { method: "POST", body: fd });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error("folder create failed: " + r.status + " " + txt);
      }
      await apiList();
    } catch (e: any) {
      // backend may not have folders yet; keep UI stable
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    apiList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFilesClick() {
    fileInputRef.current?.click();
  }

  function onFilesSelected(list: FileList | null) {
    if (!list || list.length === 0) return;
    const arr = Array.from(list);
    setSelectedFiles(arr);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    const arr = Array.from(dt.files || []);
    if (arr.length) setSelectedFiles(arr);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  return (
    <div className="sw-page">
      <div className="sw-header">
        <div className="sw-header-left">
          <div className="sw-kicker">{t("kicker").toUpperCase()}</div>
          <div className="sw-title">{t("title")}</div>
          <div className="sw-lead">{t("lead")}</div>
        </div>

        <div className="sw-header-actions">
          <button className="erp-btn" onClick={apiList} disabled={loading}>
            {t("refresh")}
          </button>
          <button className="erp-btn" onClick={apiCreateFolder}>
            {t("newFolder")}
          </button>
        </div>
      </div>

      {!apiOk ? (
        <div className="sw-banner sw-banner-warn">
          <div className="sw-banner-title">{t("apiOffTitle")}</div>
          <div className="sw-banner-body">{t("apiOffBody")}</div>
        </div>
      ) : null}

      {err ? <div className="sw-banner sw-banner-err">{err}</div> : null}

      <div className="sw-body">
        <aside className="sw-sidebar">
          <div className="sw-sidebar-title">{t("folders")}</div>

          <div className="sw-folder-list">
            {folders
              .filter((f) => f.parentId == null)
              .map((root) => (
                <div key={root.id} className="sw-folder-group">
                  <button
                    className={"sw-folder " + (activeFolderId === root.id ? "is-active" : "")}
                    onClick={() => setActiveFolderId(root.id)}
                    title={root.name}
                  >
                    <span className="sw-folder-dot" />
                    <span className="sw-folder-name">{root.name}</span>
                  </button>

                  <div className="sw-folder-children">
                    {folders
                      .filter((c) => c.parentId === root.id)
                      .map((c) => (
                        <button
                          key={c.id}
                          className={"sw-folder sw-folder-child " + (activeFolderId === c.id ? "is-active" : "")}
                          onClick={() => setActiveFolderId(c.id)}
                          title={c.name}
                        >
                          <span className="sw-folder-dot" />
                          <span className="sw-folder-name">{c.name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </aside>

        <main className="sw-main">
          <div className="sw-toolbar">
            <div className="sw-breadcrumb">
              <span className="sw-bc-pill">{activeFolder?.name ?? t("allDocs")}</span>
            </div>

            <div className="sw-toolbar-right">
              <input
                className="sw-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
              />
              <button className="erp-btn" onClick={onPickFilesClick}>
                {t("chooseFiles")}
              </button>
              <button className="erp-btn erp-btn-primary" onClick={() => apiUpload(selectedFiles)} disabled={uploading || selectedFiles.length === 0}>
                {uploading ? t("uploading") : t("upload")}
              </button>
            </div>
          </div>

          <div className="sw-grid">
            <section className="sw-card">
              <div className="sw-card-head">
                <div className="sw-card-title">{t("upload")}</div>
                <div className="sw-card-sub">
                  {selectedFiles.length ? (
                    <span className="sw-pill">
                      {t("selected")}: {selectedFiles.length}
                    </span>
                  ) : (
                    <span className="sw-muted">{t("ready")}</span>
                  )}
                </div>
              </div>

              <div
                className={"sw-drop " + (dragOver ? "is-dragover" : "")}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={onPickFilesClick}
                role="button"
                tabIndex={0}
              >
                <input
                  ref={fileInputRef}
                  className="sw-file-input"
                  type="file"
                  multiple
                  onChange={(e) => onFilesSelected(e.target.files)}
                />
                <div className="sw-drop-title">{t("dropTitle")}</div>
                <div className="sw-drop-sub">{t("dropSub")}</div>
                <div className="sw-drop-files">
                  {selectedFiles.slice(0, 3).map((f) => (
                    <span key={f.name} className="sw-file-chip" title={f.name}>
                      {f.name}
                    </span>
                  ))}
                  {selectedFiles.length > 3 ? <span className="sw-file-chip">+{selectedFiles.length - 3}</span> : null}
                </div>
              </div>

              <div className="sw-form-row">
                <label className="sw-label">{t("client")}</label>
                <input className="sw-input" value={clientCode} onChange={(e) => setClientCode(e.target.value)} />
              </div>

              <div className="sw-form-row">
                <label className="sw-label">{t("note")}</label>
                <input className="sw-input" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              <div className="sw-form-actions">
                <button className="erp-btn" onClick={() => setSelectedFiles([])} disabled={selectedFiles.length === 0 || uploading}>
                  Clear
                </button>
              </div>
            </section>

            <section className="sw-card">
              <div className="sw-card-head">
                <div className="sw-card-title">{t("allDocs")}</div>
                <div className="sw-card-sub">{loading ? "Loading..." : ""}</div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="sw-empty">
                  <div className="sw-empty-title">{t("emptyTitle")}</div>
                  <div className="sw-empty-body">{t("emptyBody")}</div>
                </div>
              ) : (
                <div className="sw-table-wrap">
                  <table className="sw-table">
                    <thead>
                      <tr>
                        <th>{t("file")}</th>
                        <th>{t("client")}</th>
                        <th>{t("size")}</th>
                        <th>{t("created")}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((d) => (
                        <tr key={d.id}>
                          <td className="sw-td-file">
                            <div className="sw-file-name" title={d.filename}>
                              {d.filename}
                            </div>
                          </td>
                          <td>
                            <span className="sw-chip">{d.client_code || "\u2014"}</span>
                          </td>
                          <td className="sw-td-muted">{fmtSize(d.size)}</td>
                          <td className="sw-td-muted">{safeStr(d.created_at).slice(0, 16).replace("T", " ")}</td>
                          <td className="sw-td-actions">
                            <a className="erp-btn erp-btn-sm" href={downloadUrl(d.id)}>
                              {t("download")}
                            </a>
                            <button className="erp-btn erp-btn-sm erp-btn-danger" onClick={() => apiDelete(d.id)}>
                              {t("remove")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
