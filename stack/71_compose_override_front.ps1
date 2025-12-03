# 71_compose_override_front.ps1  (PS 5.1-safe, UTF-8 no BOM)
$ErrorActionPreference = "Stop"

$Root     = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2_restored"
$Compose  = Join-Path $Root "docker-compose.yml"
$Override = Join-Path $Root "docker-compose.override.yml"
$Nginx    = Join-Path $Root "nginx.conf"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

if (!(Test-Path $Compose)) { throw "docker-compose.yml not found: $Compose" }

# 1) Найти сервис фронта по порту 5173:80
$yml = Get-Content $Compose -Raw
$blocks = ($yml -split "(?m)^(?=\S)") | Where-Object { $_ -match "(?m)^\s*[A-Za-z0-9_\-]+\s*:\s*" }
$frontSvc = $null
foreach($blk in $blocks){
  if ($blk -match "(?m)^\s*ports\s*:\s*[\s\S]*?5173:80"){
    $first = ($blk -split "`n")[0]
    $frontSvc = ($first -replace "^\s*","") -replace ":\s*$",""
    break
  }
}
if(-not $frontSvc){ throw "Не найден сервис с портом 5173:80 в docker-compose.yml" }
Ok "Front service: $frontSvc"

# 2) Убедимся, что nginx.conf есть (если нет — создадим минимальный с «заглушками»)
if (!(Test-Path $Nginx)){
  $conf = @'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.1 valid=30s ipv6=off;

    location / { try_files $uri $uri/ /index.html; }

    location = /api/health { proxy_pass http://host.docker.internal:8000/health; }
    location = /api/config { proxy_pass http://host.docker.internal:8000/config; }

    # demo stubs
    location = /api/tasks { default_type application/json; return 200 '[]'; }
    location = /api/tasks/today { default_type application/json; return 200 '[]'; }
    location = /api/tasks/report/today_by_assignee { default_type application/json; return 200 '{"items":[]}'; }
    location = /api/tasks/export { default_type application/json; return 200 '{"status":"ok"}'; }

    location /api/ { proxy_pass http://host.docker.internal:8000/api/; }
}
'@
  [IO.File]::WriteAllText($Nginx, $conf, [Text.UTF8Encoding]::new($false))
  Ok "nginx.conf created (UTF-8 no BOM)"
}

# 3) Запишем override YAML без ловушек интерполяции ($var:)
$lines = @(
  "services:",
  "  ${frontSvc}:",
  "    volumes:",
  "      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro"
)
$ovr = ($lines -join "`r`n") + "`r`n"
[IO.File]::WriteAllText($Override, $ovr, [Text.UTF8Encoding]::new($false))
Ok "docker-compose.override.yml written"

# 4) Проверим конфиг и перезапустим только фронт
Info "docker compose config (with override)"
docker compose -f $Compose -f $Override config | Out-Null
Ok "Compose config is valid"

Info "docker compose up -d (front only)"
docker compose -f $Compose -f $Override up -d $frontSvc | Out-Null
Ok "Front restarted with mounted nginx.conf"

# 5) Смоук
function Hit($u){ try{ (Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 6).StatusCode }catch{ $_.Exception.Message } }
Start-Sleep 2
Ok ("ROOT   => {0}" -f (Hit "http://localhost:5173/"))
Ok ("HEALTH => {0}" -f (Hit "http://localhost:5173/api/health"))
Ok ("CONFIG => {0}" -f (Hit "http://localhost:5173/api/config"))
Ok ("TASKS  => {0}" -f (Hit "http://localhost:5173/api/tasks"))
