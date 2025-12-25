param(
  [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

function Join-Url([string]$Base, [string]$Rel) {
  $b = $Base.TrimEnd("/")
  if (-not $Rel.StartsWith("/")) { $Rel = "/" + $Rel }
  return $b + $Rel
}

function Try-GetJson([string]$Url, [int]$TimeoutSec = 8) {
  try {
    return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec $TimeoutSec
  } catch {
    return $null
  }
}

Write-Host "== dev_list_clients ==" -ForegroundColor Cyan
Write-Host ("base=" + $BaseUrl) -ForegroundColor Cyan

# Attempt 1: common endpoints (non-fatal if missing)
$endpoints = @(
  "/api/clients",
  "/api/internal/clients",
  "/api/internal/client-profiles",
  "/api/internal/client-profiles/list"
)

$found = $null
foreach ($p in $endpoints) {
  $u = Join-Url $BaseUrl $p
  $j = Try-GetJson $u
  if ($j) { $found = @{ path=$p; data=$j }; break }
}

if ($found) {
  Write-Host ("source=" + $found.path) -ForegroundColor Green
  $data = $found.data

  # Try to extract client codes from common shapes
  $codes = @()

  if ($data -is [System.Array]) {
    foreach ($x in $data) {
      if ($x.client_code) { $codes += [string]$x.client_code; continue }
      if ($x.clientCode) { $codes += [string]$x.clientCode; continue }
      if ($x.code) { $codes += [string]$x.code; continue }
      if ($x.key) { $codes += [string]$x.key; continue }
      if ($x.id) { $codes += [string]$x.id; continue }
    }
  } elseif ($data.items -is [System.Array]) {
    foreach ($x in $data.items) {
      if ($x.client_code) { $codes += [string]$x.client_code; continue }
      if ($x.clientCode) { $codes += [string]$x.clientCode; continue }
      if ($x.code) { $codes += [string]$x.code; continue }
      if ($x.key) { $codes += [string]$x.key; continue }
      if ($x.id) { $codes += [string]$x.id; continue }
    }
  }

  $codes = $codes | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Unique
  if (-not $codes -or $codes.Count -eq 0) {
    Write-Host "[WARN] could_not_extract_codes_from_response" -ForegroundColor Yellow
    exit 1
  }

  $codes | Sort-Object | ForEach-Object { Write-Host $_ }
  exit 0
}

Write-Host "[WARN] no_clients_endpoint_found" -ForegroundColor Yellow
Write-Host "[HINT] use tools\clients_default.txt as default list" -ForegroundColor Yellow
exit 1