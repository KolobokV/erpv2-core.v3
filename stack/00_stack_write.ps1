param(
  [string]$BaseDir = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2",
  [string]$FrontDir = "C:\Users\User\Desktop\ERP\ERPv2_front_stage1",
  [string]$ApiBase = "http://host.docker.internal:8000"
)

$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }

# 1) Папка
New-Item -Force -ItemType Directory -Path $BaseDir | Out-Null

# 2) docker-compose.yml
$compose = @"
name: erpv2_stack_stage2

services:
  front:
    build:
      context: ${FrontDir}
      dockerfile: Dockerfile
    image: erpv2_front_stage1-erpv2_front
    ports:
      - "5173:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost | grep -q '<!doctype html>' || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 10
"@
Set-Content -LiteralPath (Join-Path $BaseDir "docker-compose.yml") -Value $compose -Encoding UTF8

# 3) 01_up.ps1
$up = @'
param([string]$BaseDir = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2")
$ErrorActionPreference = "Stop"
function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }

Push-Location $BaseDir
try {
  Info "docker compose build"
  docker compose build
  Info "docker compose up -d"
  docker compose up -d
  Start-Sleep -Seconds 3
  Ok "Stack is up. Try: http://localhost:5173"
} finally { Pop-Location }
'@
Set-Content -LiteralPath (Join-Path $BaseDir "01_up.ps1") -Value $up -Encoding UTF8

# 4) 02_down.ps1
$down = @'
param([string]$BaseDir = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2")
$ErrorActionPreference = "Stop"
function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }

Push-Location $BaseDir
try {
  Info "docker compose down --remove-orphans"
  docker compose down --remove-orphans
  Ok "Stopped."
} finally { Pop-Location }
'@
Set-Content -LiteralPath (Join-Path $BaseDir "02_down.ps1") -Value $down -Encoding UTF8

# 5) 03_smoke.ps1
$smoke = @'
param([string]$FrontUrl = "http://localhost:5173")
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }

function Hit($url){
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 8
    Ok ("{0} => {1}" -f $url, [int]$r.StatusCode)
  } catch {
    Warn ("{0} => {1}" -f $url, $_.Exception.Message)
  }
}

Hit "$FrontUrl/"
Hit "$FrontUrl/api/health"
Hit "$FrontUrl/api/config"
Hit "$FrontUrl/api/tasks"
Hit "$FrontUrl/api/tasks/today"
Hit "$FrontUrl/api/tasks/report/today_by_assignee"
Hit "$FrontUrl/api/tasks/export"
'@
Set-Content -LiteralPath (Join-Path $BaseDir "03_smoke.ps1") -Value $smoke -Encoding UTF8

# 6) 98_front_fix_no_interp.ps1 (не меняем)
$fix = @"
param(
  [string]$FrontDir = "C:\Users\User\Desktop\ERP\ERPv2_front_stage1",
  [string]$ApiBase  = "$ApiBase"
)
\$ErrorActionPreference = "Stop"
function Ok(\$m){ Write-Host "[OK] \$m" -ForegroundColor Green }
function Info(\$m){ Write-Host "== \$m ==" -ForegroundColor Cyan }

\$nginx = Join-Path \$FrontDir "nginx.conf"
if(-not (Test-Path \$nginx)){ throw "nginx.conf not found: \$nginx" }

\$conf = @'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.11 valid=30s ipv6=off;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location = /api/health {
        proxy_pass __API_BASE__/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    location = /api/config {
        proxy_pass __API_BASE__/config;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_redirect off;
    }

    location /api/ {
        proxy_pass __API_BASE__/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_redirect off;
    }
}
'@
\$conf = \$conf.Replace('__API_BASE__', \$ApiBase)
\$utf8NoBom = New-Object System.Text.UTF8Encoding(\$false)
[System.IO.File]::WriteAllText(\$nginx, \$conf, \$utf8NoBom)
Ok "nginx.conf rewritten (UTF-8 no BOM)"

Push-Location \$FrontDir
try {
  Info "compose down"
  docker compose down --remove-orphans | Out-Null
  Info "compose build --no-cache"
  docker compose build --no-cache | Out-Null
  Info "compose up -d"
  docker compose up -d | Out-Null
} finally { Pop-Location }
"@
Set-Content -LiteralPath (Join-Path $BaseDir "98_front_fix_no_interp.ps1") -Value $fix -Encoding UTF8

Ok "Files written → $BaseDir"
