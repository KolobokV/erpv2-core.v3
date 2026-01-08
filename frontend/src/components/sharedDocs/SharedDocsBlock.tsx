import { useEffect, useMemo, useRef, useState } from "react";

type DocMeta = {
  id: string;
  name: string;
  size: number;
  mime: string;
  created_at: string; // ISO
  note?: string;
};

type DocRecord = {
  meta: DocMeta;
  data: ArrayBuffer;
};

const DB_NAME = "erpv2_shared_docs_v1";
const DB_STORE = "docs";
const DB_VER = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "meta.id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(rec: DocRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(DB_STORE).put(rec);
    });
  } finally {
    db.close();
  }
}

async function dbGetAll(): Promise<DocMeta[]> {
  const db = await openDb();
  try {
    return await new Promise<DocMeta[]>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as DocRecord[];
        resolve(items.map((x) => x.meta));
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function dbGet(id: string): Promise<DocRecord | null> {
  const db = await openDb();
  try {
    return await new Promise<DocRecord | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as DocRecord) || null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function dbDelete(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(DB_STORE).delete(id);
    });
  } finally {
    db.close();
  }
}

function fmtSize(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const s = i === 0 ? String(Math.round(v)) : v.toFixed(v >= 10 ? 1 : 2);
  return `${s} ${units[i]}`;
}

function isoLocal(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function uid(): string {
  const a = Math.random().toString(16).slice(2);
  const b = Date.now().toString(16);
  return `${b}-${a}`;
}

async function fileToArrayBuffer(f: File): Promise<ArrayBuffer> {
  return await f.arrayBuffer();
}

export function SharedDocsBlock() {
  const [items, setItems] = useState<DocMeta[]>([]);
  const [err, setErr] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    try {
      setErr("");
      const all = await dbGetAll();
      all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setItems(all);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      setErr("");
      const f = files[0];
      const data = await fileToArrayBuffer(f);
      const now = new Date();
      const meta: DocMeta = {
        id: uid(),
        name: f.name || "file",
        size: f.size || 0,
        mime: f.type || "application/octet-stream",
        created_at: now.toISOString(),
        note: note.trim() ? note.trim() : undefined,
      };
      await dbPut({ meta, data });
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      await reload();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function onDownload(id: string) {
    try {
      setErr("");
      const rec = await dbGet(id);
      if (!rec) return;
      const blob = new Blob([rec.data], { type: rec.meta.mime || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = rec.meta.name || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0444\u0430\u0439\u043b?")) return;
    try {
      setErr("");
      await dbDelete(id);
      await reload();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((x) => {
      const hay = `${x.name} ${x.note || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, q]);

  return (
    <div className="sd">
      <div className="sd-head">
        <div className="sd-title">{"\u041e\u0431\u0449\u0438\u0435 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b"}</div>
        <button className="sd-btn sd-btn-ghost" type="button" onClick={reload}>
          {"\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c"}
        </button>
      </div>

      <div className="sd-create">
        <input
          className="sd-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 (optional)\u2026"}
        />
        <input
          ref={inputRef}
          className="sd-file"
          type="file"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      <div className="sd-tools">
        <input
          className="sd-input sd-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={"\u041f\u043e\u0438\u0441\u043a\u2026"}
        />
        <div className="sd-meta">
          <span className="sd-pill">{filtered.length}</span>
          <span className="sd-muted">{"\u0444\u0430\u0439\u043b(\u043e\u0432)"}</span>
        </div>
      </div>

      {err ? <div className="sd-error">{err}</div> : null}

      {filtered.length === 0 ? (
        <div className="sd-empty">
          {"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u0431\u0449\u0438\u0445 \u0444\u0430\u0439\u043b\u043e\u0432."}
        </div>
      ) : (
        <ul className="sd-list">
          {filtered.map((x) => (
            <li key={x.id} className="sd-item">
              <div className="sd-row">
                <div className="sd-name">{x.name}</div>
                <div className="sd-actions">
                  <button className="sd-btn sd-btn-small" type="button" onClick={() => onDownload(x.id)}>
                    {"\u0421\u043a\u0430\u0447\u0430\u0442\u044c"}
                  </button>
                  <button className="sd-btn sd-btn-small sd-btn-danger" type="button" onClick={() => onDelete(x.id)}>
                    {"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}
                  </button>
                </div>
              </div>
              <div className="sd-sub">
                <span className="sd-pill">{fmtSize(x.size)}</span>
                <span className="sd-pill">{isoLocal(new Date(x.created_at))}</span>
                {x.note ? <span className="sd-pill sd-pill-note">{x.note}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
