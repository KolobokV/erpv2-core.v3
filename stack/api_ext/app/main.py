from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI(title="ERPv2 API Ext")

class Client(BaseModel):
    id: int
    name: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "api_ext"}

@app.get("/config")
def config():
    return {"service": "api_ext", "version": "0.1.0"}

@app.get("/clients", response_model=List[Client])
def list_clients():
    return [
        {"id": 1, "name": "Demo Client 1"},
        {"id": 2, "name": "Demo Client 2"},
    ]

@app.get("/invoices")
def invoices():
    return {
        "items": [],
        "total": 0
    }

@app.get("/products")
def products():
    return {
        "items": [
            {"sku": "P-001", "name": "Service A"},
            {"sku": "P-002", "name": "Service B"},
        ]
    }

@app.get("/debug/raw")
def debug_raw():
    return {
        "info": "debug endpoint",
        "note": "here you can expose raw internal state later"
    }

@app.post("/snapshot")
def snapshot():
    return {"status": "ok", "saved": True}