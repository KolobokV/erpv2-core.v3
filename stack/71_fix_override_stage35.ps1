param(
    [string]$Root = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage3_connect"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

if (!(Test-Path $Root)) { throw "Нет папки: $Root" }

$composePath = Join-Path $Root "docker-compose.yml"
if (!(Test-Path $composePath)) { throw "Нет docker-compose.yml: $composePath" }

# --- 1) Определяем реальное имя фронт-сервиса через docker compose config (БЕЗ override)
Info "Читаю docker compose config (без override)"

Push-Location $Root
try {
    # Явно используем только базовый файл, чтобы игнорировать битый override
    $cfgJson = docker compose -f "docker-compose.yml" config --format json
} finally {
    Pop-Location
}

if (-not $cfgJson) { throw "docker compose config вернул пустой результат" }

$cfg = $cfgJson | ConvertFrom-Json

if (-not $cfg.services) { throw "В config нет services — проверь docker-compose.yml" }

# Ищем сервис, публикующий порт 5173
$frontName = $null
foreach($prop in $cfg.services.PSObject.Properties){
    $name = $prop.Name
    $svc  = $prop.Value
    # ports может быть массивом строк типа "5173:80" или "0.0.0.0:5173->80/tcp"
    if ($svc.ports){
        foreach($p in $svc.ports){
            $ps = [string]$p
            if ($ps -match "5173"){
                $frontName = $name
                break
            }
        }
    }
    if ($frontName){ break }
}

if (-not $frontName){
    # если вдруг не нашли по порту — берём первый сервис как фронт (для нашего проекта хватит)
    $frontName = $cfg.services.PSObject.Properties.Name | Select-Object -First 1
    Warn "Не удалось найти сервис с портом 5173, беру первый сервис как фронт: $frontName"
} else {
    Ok "Фронт-сервис определён как: $frontName"
}

# --- 2) Пишем docker-compose.override.yml заново
$overridePath = Join-Path $Root "docker-compose.override.yml"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$override = @"
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

  $frontName:
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
"@

[System.IO.File]::WriteAllText($overridePath, $override, $utf8NoBom)
Ok "docker-compose.override.yml перезаписан: $overridePath"

# --- 3) Проверяем итоговую конфигурацию (уже с override)
Info "Проверяю docker compose config (с override)"

Push-Location $Root
try {
    # сейчас compose подхватит docker-compose.yml + docker-compose.override.yml автоматически
    docker compose config > "$Root\docker-compose.full.yml"
} catch {
    Fail "docker compose config вернул ошибку: $($_.Exception.Message)"
    throw
} finally {
    Pop-Location
}

Ok "docker-compose.yml + override синтаксически корректны (см. docker-compose.full.yml)"
