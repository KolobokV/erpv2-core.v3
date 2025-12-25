param(
  [string]$BaseUrl = "http://localhost:8000",
  [int]$Year = 2025,
  [int]$FromMonth = 1,
  [int]$ToMonth = 0,
  [string]$ClientsCsv = "",
  [string[]]$Clients = @(),
  [string]$DefaultsFile = ".\tools\clients_default.txt",
  [int]$TimeoutSec = 120,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Join-Url([string]$Base, [string]$Rel) {
  $b = $Base.TrimEnd("/")
  if (-not $Rel.StartsWith("/")) { $Rel = "/" + $Rel }
  return $b + $Rel
}

function Ping-Backend([string]$Base) {
  try {
    $r = Invoke-WebRequest -Uri (Join-Url $Base "/docs") -UseBasicParsing -TimeoutSec 10
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  } catch { return $false }
}

function Normalize-Clients([string]$ClientsCsv, [string[]]$ClientsArr) {
  $tmp = @()
  if ($ClientsArr -and $ClientsArr.Count -gt 0) { foreach ($c in $ClientsArr) { if ($c) { $tmp += $c } } }
  if ($ClientsCsv -and $ClientsCsv.Trim().Length -gt 0) { $tmp += $ClientsCsv }

  $out = New-Object System.Collections.Generic.List[string]
  foreach ($x in $tmp) {
    if (-not $x) { continue }
    $s = $x.Trim()
    if ($s.Length -eq 0) { continue }
    if ($s.Contains(",")) {
      foreach ($p in $s.Split(",")) {
        $q = $p.Trim()
        if ($q.Length -gt 0) { $out.Add($q) }
      }
    } else {
      $out.Add($s)
    }
  }
  $uniq = $out | Select-Object -Unique
  if (-not $uniq) { return @() }
  return @($uniq)
}

function Read-Defaults([string]$Path) {
  try {
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    $lines = Get-Content -LiteralPath $Path -ErrorAction Stop
    $lines = $lines | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_.Length -gt 0 -and -not $_.StartsWith("#") }
    return @($lines | Select-Object -Unique)
  } catch { return @() }
}

function Invoke-DevRun([string]$Base, [string]$Client, [int]$Year, [int]$Month, [int]$TimeoutSec) {
  $path = "/api/internal/process-chains/dev/run-for-client/${Client}?year=$Year&month=$Month"
  $u = Join-Url $Base $path

  try {
    $res = Invoke-RestMethod -Method Post -Uri $u -TimeoutSec $TimeoutSec
    $status = $null
    $runId = $null
    $engine = $null
    $started = $null
    $finished = $null
    try {
      $status = [string]$res.status
      $runId = $res.run.id
      $engine = $res.run.engine
      $started = $res.run.started_at
      $finished = $res.run.finished_at
    } catch { }

    $okFinal = ($status -eq "ok")
    return @{
      ok=$okFinal; http=200; status=$status; run_id=$runId; engine=$engine;
      started_at=$started; finished_at=$finished; url=$u; error=$null
    }
  } catch {
    $code = $null
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    return @{ ok=$false; http=$code; status="fail"; url=$u; error=$_.Exception.Message }
  }
}

if (-not (Ping-Backend $BaseUrl)) {
  Write-Host "[ERR] backend_not_reachable base=$BaseUrl" -ForegroundColor Red
  exit 2
}

if ($ToMonth -eq 0) { $ToMonth = $FromMonth }

$ClientsFinal = Normalize-Clients -ClientsCsv $ClientsCsv -ClientsArr $Clients
if (-not $ClientsFinal -or $ClientsFinal.Count -eq 0) { $ClientsFinal = Read-Defaults -Path $DefaultsFile }
if (-not $ClientsFinal -or $ClientsFinal.Count -eq 0) { throw "clients_empty" }

if ($FromMonth -lt 1 -or $FromMonth -gt 12) { throw "from_month_invalid" }
if ($ToMonth -lt 1 -or $ToMonth -gt 12) { throw "to_month_invalid" }
if ($FromMonth -gt $ToMonth) { throw "from_gt_to" }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$root = if ($OutDir -and $OutDir.Trim().Length -gt 0) { $OutDir } else { Join-Path (Get-Location) "reports" }
Ensure-Dir $root
$reportPath = Join-Path $root ("chains_matrix_" + $stamp + ".json")

$results = @()
$failCount = 0
$total = 0

foreach ($c in $ClientsFinal) {
  for ($m = $FromMonth; $m -le $ToMonth; $m++) {
    $total++
    Write-Host "[RUN] client=$c year=$Year month=$m" -ForegroundColor Cyan
    $r = Invoke-DevRun -Base $BaseUrl -Client $c -Year $Year -Month $m -TimeoutSec $TimeoutSec
    if (-not $r.ok) { $failCount++ }

    $results += [pscustomobject]@{
      client = $c
      year = $Year
      month = $m
      ok = $r.ok
      http = $r.http
      status = $r.status
      run_id = $r.run_id
      engine = $r.engine
      started_at = $r.started_at
      finished_at = $r.finished_at
      url = $r.url
      error = $r.error
    }
  }
}

$out = [pscustomobject]@{
  summary = @{
    base_url = $BaseUrl
    year = $Year
    from_month = $FromMonth
    to_month = $ToMonth
    clients = $ClientsFinal
    total = $total
    failed = $failCount
    created_at = (Get-Date).ToString("o")
  }
  results = $results
}

$out | ConvertTo-Json -Depth 12 | Out-File -FilePath $reportPath -Encoding utf8

Write-Host "[OK] report=$reportPath" -ForegroundColor Green
Write-Host "[OK] total=$total failed=$failCount" -ForegroundColor Green
if ($failCount -gt 0) { exit 1 } else { exit 0 }