# 71_compose_override_front.ps1  (PowerShell 5.1-safe, ASCII only)
$ErrorActionPreference = "Stop"

$Root = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2_restored"
$Compose = Join-Path $Root "docker-compose.yml"
$Override = Join-Path $Root "docker-compose.override.yml"
$Nginx = Join-Path $Root "nginx.conf"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function OK($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

if (!(Test-Path $Compose)) { throw "docker-compose.yml not found: $Compose" }

# Detect service that exposes 5173:80
$yml = Get-Content $Compose -Raw
$services = ($yml -split "(?m)^(?=\S)") | Where-Object { $_ -match "(?m)^\s*[A-Za-z0-9_\-]+\s*:\s*" }
$frontSvc = $null
foreach($blk in $services){
  if ($blk -match "(?m)^\s*ports\s*:\s*[\s\S]*?5173:80"){
    $firstLine = ($blk -split "`n")[0]
    $frontSvc = ($firstLine -replace "^\s*","") -replace ":\s*$",""
    break
  }
}
if(-not $frontSvc){ throw "Cannot find service with port 5173:80 in docker-compose.yml" }
OK "Front service: $frontSvc"

# Ensure nginx.conf exists (if not, write a minimal one with stubs)
if (!(Test-Path $Nginx)){
  $conf = @'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.1 valid=30s ipv6=off;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location = /api/health {
        proxy_pass http://host.docker.internal:8000/health;
    }
    location = /api/config {
        proxy_pass http://host.docker.internal:8000/config;
    }

    # demo stubs
    location = /api/tasks { default_type application/json; return 200 '[]'; }
    location = /api/tasks/today { default_type application/json; return 200 '[]'; }
    location = /api/tasks/report/today_by_assignee { default_type application/json; return 200 '{"items":[]}'; }
    location = /api/tasks/export { default_type application/json; return 200 '{"status":"ok"}'; }

    location /api/ {
        proxy_pass http://host.docker.internal:8000/api/;
    }
}
'@
  [IO.File]::WriteAllText($Nginx, $conf, [Text.UTF8Encoding]::new($false))
  OK "nginx.conf created (UTF-8 no BOM)"
}

# Write override file (mount nginx.conf into the front)
$ovr = @"
services:
  $frontSvc:
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
"@
[IO.File]::WriteAllText($Override, $ovr, [Text.UTF8Encoding]::new($false))
OK "docker-compose.override.yml written"

# Validate and apply
Info "docker compose config (with override)"
docker compose -f $Compose -f $Override config | Out-Null
OK "Compose config is valid"

Info "docker compose up -d (front only)"
docker compose -f $Compose -f $Override up -d $frontSvc | Out-Null
OK "Front restarted with mounted nginx.conf"

# Quick smoke
function Hit($u){ try{ (Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 6).StatusCode }catch{ $_.Exception.Message } }
Start-Sleep 2
OK ("ROOT => {0}" -f (Hit "http://localhost:5173/"))
OK ("HEALTH => {0}" -f (Hit "http://localhost:5173/api/health"))
OK ("CONFIG => {0}" -f (Hit "http://localhost:5173/api/config"))
OK ("TASKS => {0}" -f (Hit "http://localhost:5173/api/tasks"))
