Param(
  [string]$OutRoot = "..\_backups"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here\..

# 1) Подтягиваем переменные из .env (MYSQL_*)
$envPath = ".\.env"
if (-not (Test-Path $envPath)) { throw ".env не найден: $envPath" }
$vars = @{}
Get-Content $envPath | ForEach-Object {
  if ($_ -match "^\s*#") { return }
  if ($_ -match "^\s*$") { return }
  $k,$v = $_ -split "=",2
  $vars[$k.Trim()] = $v.Trim()
}
$DB  = $vars["MYSQL_DATABASE"]
$DBU = $vars["MYSQL_USER"]
$DBP = $vars["MYSQL_PASSWORD"]
if (-not $DB -or -not $DBU -or -not $DBP) { throw "Не нашёл MYSQL_* в .env" }

# 2) Ищем контейнеры (наиболее характерные)
$cidDb = (docker ps --format "{{.ID}} {{.Image}} {{.Names}}" | Select-String -Pattern "mariadb:10\.11" | Select-Object -First 1)
if ($cidDb) { $cidDb = $cidDb.ToString().Split()[0] }
if (-not $cidDb) { throw "Контейнер MariaDB 10.11 не найден. Проверь docker ps" }

$cidDoli = (docker ps --format "{{.ID}} {{.Image}} {{.Names}}" | Select-String -Pattern "dolibarr" | Select-Object -First 1)
if ($cidDoli) { $cidDoli = $cidDoli.ToString().Split()[0] }
if (-not $cidDoli) { throw "Контейнер Dolibarr не найден. Проверь docker ps" }

# 3) Папка результата
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $OutRoot $ts
New-Item -ItemType Directory -Force $outDir | Out-Null

Write-Host "== Бэкап MariaDB =="

# создаём дамп внутри контейнера, затем копируем наружу
docker exec ${cidDb} sh -lc "mysqldump -u${DBU} -p${DBP} ${DB} | gzip > /tmp/${DB}.sql.gz"
docker cp "${cidDb}:/tmp/${DB}.sql.gz" ("{0}\db_{1}.sql.gz" -f $outDir, $DB)
docker exec ${cidDb} sh -lc "rm -f /tmp/${DB}.sql.gz"
Write-Host ("   -> {0}\db_{1}.sql.gz" -f $outDir, $DB)

Write-Host "== Бэкап документов Dolibarr =="

# архивируем /var/www/documents внутри контейнера dolibarr и копируем
docker exec ${cidDoli} sh -lc "tar czf /tmp/doli_docs.tgz -C /var/www documents"
docker cp "${cidDoli}:/tmp/doli_docs.tgz" ("{0}\doli_docs.tgz" -f $outDir)
docker exec ${cidDoli} sh -lc "rm -f /tmp/doli_docs.tgz"
Write-Host ("   -> {0}\doli_docs.tgz" -f $outDir)

Write-Host "== Готово! ==" -ForegroundColor Green
Write-Host ("Папка бэкапа: {0}" -f $outDir)
