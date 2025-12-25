param(
  [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

function Join-Url([string]$Base, [string]$Rel) {
  $b = $Base.TrimEnd("/")
  $r = $Rel
  if (-not $r.StartsWith("/")) { $r = "/" + $r }
  return $b + $r
}

function Check-GET([string]$Base, [string]$Path, [int]$TimeoutSec = 8) {
  $u = Join-Url $Base $Path
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec $TimeoutSec
    return [pscustomobject]@{ ok=$true; method="GET"; path=$Path; http=$r.StatusCode; url=$u; note="" }
  } catch {
    $code = $null
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    return [pscustomobject]@{ ok=$false; method="GET"; path=$Path; http=$code; url=$u; note=$_.Exception.Message }
  }
}

function Check-POST([string]$Base, [string]$Path, [int]$TimeoutSec = 12) {
  $u = Join-Url $Base $Path
  try {
    $r = Invoke-WebRequest -Method Post -Uri $u -UseBasicParsing -TimeoutSec $TimeoutSec
    return [pscustomobject]@{ ok=$true; method="POST"; path=$Path; http=$r.StatusCode; url=$u; note="" }
  } catch {
    $code = $null
    try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
    return [pscustomobject]@{ ok=$false; method="POST"; path=$Path; http=$code; url=$u; note=$_.Exception.Message }
  }
}

Write-Host "== ERPv2 system probe ==" -ForegroundColor Cyan
Write-Host ("base=" + $BaseUrl) -ForegroundColor Cyan

$checks = @()

# Core availability
$checks += Check-GET $BaseUrl "/docs"
$checks += Check-GET $BaseUrl "/openapi.json"

# Known internal areas (some may be 404 depending on stage; we want to SEE it)
$checks += Check-GET $BaseUrl "/api/internal/process-chains/dev/"
$checks += Check-POST $BaseUrl "/api/internal/process-chains/dev/run-for-client/ip_usn_dr?year=2025&month=12"

# Typical UI-linked endpoints (may exist or not; probe reveals broken wiring)
$checks += Check-GET $BaseUrl "/api/tasks"
$checks += Check-GET $BaseUrl "/api/internal/process-instances-v2"
$checks += Check-GET $BaseUrl "/api/internal/control-events"
$checks += Check-GET $BaseUrl "/api/internal/internal-control-events-store"
$checks += Check-GET $BaseUrl "/api/internal/definitions"

$ok = ($checks | Where-Object { $_.ok }).Count
$bad = ($checks | Where-Object { -not $_.ok }).Count

$checks | Format-Table ok,method,http,path -AutoSize

Write-Host ("ok=" + $ok + " bad=" + $bad) -ForegroundColor Green
if ($bad -gt 0) { exit 1 } else { exit 0 }