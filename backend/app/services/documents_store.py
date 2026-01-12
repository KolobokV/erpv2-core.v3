from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import UploadFile

DEFAULT_ROOT = Path(__file__).resolve().parents[2] / "storage" / "documents"
INDEX_NAME = "index.json"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class DocumentsStore:
    def __init__(self, root: Optional[Path] = None):
        self.root = (root or DEFAULT_ROOT).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.index_path = self.root / INDEX_NAME
        if not self.index_path.exists():
            self._write_index({"items": []})

    def _read_index(self) -> Dict[str, Any]:
        try:
            raw = self.index_path.read_text(encoding="utf-8")
            data = json.loads(raw) if raw.strip() else {"items": []}
            if not isinstance(data, dict) or "items" not in data or not isinstance(data["items"], list):
                return {"items": []}
            return data
        except Exception:
            return {"items": []}

    def _write_index(self, data: Dict[str, Any]) -> None:
        tmp = self.index_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")
        tmp.replace(self.index_path)

    def list(self, client_code: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read_index()
        items = data.get("items", [])
        if client_code:
            cc = client_code.strip()
            items = [x for x in items if (x.get("client_code") or "") == cc]
        items.sort(key=lambda x: (x.get("created_at") or ""), reverse=True)
        return items

    def get(self, doc_id: str) -> Optional[Dict[str, Any]]:
        data = self._read_index()
        for x in data.get("items", []):
            if x.get("id") == doc_id:
                return x
        return None

    def resolve_path(self, doc_id: str) -> Optional[Path]:
        folder = self.root / doc_id
        if not folder.exists() or not folder.is_dir():
            return None
        item = self.get(doc_id)
        if item and item.get("filename"):
            candidate = folder / str(item["filename"])
            if candidate.exists() and candidate.is_file():
                return candidate
        for p in folder.iterdir():
            if p.is_file():
                return p
        return None

    async def save_upload(self, f: UploadFile, client_code: Optional[str] = None) -> Dict[str, Any]:
        doc_id = uuid.uuid4().hex
        folder = self.root / doc_id
        folder.mkdir(parents=True, exist_ok=True)

        filename = os.path.basename(f.filename or "file")
        if not filename:
            filename = "file"

        dst = folder / filename

        with dst.open("wb") as out:
            while True:
                chunk = await f.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)

        size = dst.stat().st_size if dst.exists() else 0
        mime = getattr(f, "content_type", None) or "application/octet-stream"

        item: Dict[str, Any] = {
            "id": doc_id,
            "filename": filename,
            "size": int(size),
            "mime": mime,
            "client_code": (client_code.strip() if client_code else None),
            "created_at": _utc_now_iso(),
        }

        data = self._read_index()
        data.setdefault("items", []).append(item)
        self._write_index(data)

        return item
