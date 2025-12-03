param(
    [string]$Root = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage3_connect"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }

if (!(Test-Path $Root)) { throw "Нет папки: $Root" }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# --- 1) api_ext (FastAPI на 8088) ---

$apiRoot = Join-Path $Root "api_ext"
$appDir  = Join-Path $apiRoot "app"

New-Item -ItemType Directory -Force -Path $appDir | Out-Null

# main.py с нужными ручками
$mainPy = @'
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
'@

[System.IO.File]::WriteAllText((Join-Path $appDir "main.py"), $mainPy, $utf8NoBom)

# requirements.txt
$req = @'
fastapi==0.115.5
uvicorn==0.30.6
pydantic==2.9.2
'@
[System.IO.File]::WriteAllText((Join-Path $apiRoot "requirements.txt"), $req, $utf8NoBom)

# Dockerfile
$df = @'
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY app /app/app

EXPOSE 8088

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8088"]
'@
[System.IO.File]::WriteAllText((Join-Path $apiRoot "Dockerfile"), $df, $utf8NoBom)

# --- 2) nginx.conf (будет монтироваться во фронт) ---

$nginxConf = @'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.11 valid=30s ipv6=off;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # базовый API на 8000 (если запущен)
    location = /api/health {
        proxy_pass http://host.docker.internal:8000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    location = /api/config {
        proxy_pass http://host.docker.internal:8000/config;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    location /api/ {
        proxy_pass http://host.docker.internal:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    # расширенное API через префикс /api-ext/
    location /api-ext/ {
        proxy_pass http://erpv2_api_ext:8088/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    # удобные короткие пути (без префикса) на тот же erpv2_api_ext
    location = /clients {
        proxy_pass http://erpv2_api_ext:8088/clients;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    location = /invoices {
        proxy_pass http://erpv2_api_ext:8088/invoices;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    location = /products {
        proxy_pass http://erpv2_api_ext:8088/products;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_redirect off;
    }
}
'@

[System.IO.File]::WriteAllText((Join-Path $Root "nginx.conf"), $nginxConf, $utf8NoBom)

# --- 3) docker-compose.override.yml ---

$override = @'
services:
  erpv2_api_ext:
    build:
      context: ./api_ext
    container_name: erpv2_stack_stage3_api_ext
    ports:
      - "8088:8088"
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8088/health"]
      interval: 10s
      timeout: 3s
      retries: 10

  erpv2_front:
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
'@

[System.IO.File]::WriteAllText((Join-Path $Root "docker-compose.override.yml"), $override, $utf8NoBom)

Ok "Файлы Stage 3.5 (api_ext, nginx.conf, override) созданы в $Root"
