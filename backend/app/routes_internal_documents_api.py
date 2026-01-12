from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from starlette.responses import FileResponse
from typing import List, Optional

from app.services.documents_store import DocumentsStore

router = APIRouter(prefix="/api/internal/documents", tags=["internal-documents"])

store = DocumentsStore()


@router.get("")
def list_documents(client: Optional[str] = None):
    items = store.list(client_code=client)
    return {"items": items}


@router.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    client_code: Optional[str] = Form(default=None),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    created = []
    for f in files:
        created.append(await store.save_upload(f, client_code=client_code))
    return {"items": created}


@router.get("/{doc_id}/download")
def download_document(doc_id: str):
    item = store.get(doc_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    path = store.resolve_path(doc_id)
    if not path:
        raise HTTPException(status_code=404, detail="Not found")

    filename = item.get("filename") or path.name
    media_type = item.get("mime") or "application/octet-stream"

    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=filename,
    )


@router.get("/{doc_id}/download/{filename}")
def download_document_named(doc_id: str, filename: str):
    return download_document(doc_id)
