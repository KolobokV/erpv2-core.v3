param(
  [string]$BaseUrl = "http://localhost:8000",
  [string]$OutFile = ".\tools\clients_default.txt"
)

$ErrorActionPreference = "Stop"

function Join-Url([string]$Base, [string]$Rel) {
  $b = $Base.TrimEnd("/")
  if (-not $Rel.StartsWith("/")) { $Rel = "/" + $Rel }
  return $b + $Rel
}

function Get-Json([string]$Url, [int]$TimeoutSec = 10) {
  return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec $TimeoutSec
}

function Extract-Codes($data) {
  $codes = New-Object System.Collections.Generic.List[string]

  # shapes supported:
  # 1) array of objects
  # 2) { items: [...] }
  # 3) { data: [...] }
  $arr = $null
  if ($data -is [System.Array]) { $arr = $data }
  elseif ($data.items -is [System.Array]) { $arr = $data.items }
  elseif ($data.data -is [System.Array]) { $arr = $data.data }

  if (-not $arr) { return @() }

  foreach ($x in $arr) {
    if ($null -ne $x.client_code -and [string]$x.client_code) { $codes.Add(([string]$x.client_code).Trim()); continue }
    if ($null -ne $x.clientCode -and [string]$x.clientCode) { $codes.Add(([string]$x.clientCode).Trim()); continue }
    if ($null -ne $x.code -and [string]$x.code) { $codes.Add(([string]$x.code).Trim()); continue }
    if ($null -ne $x.key -and [string]$x.key) { $codes.Add(([string]$x.key).Trim()); continue }
    if ($null -ne $x.id -and [string]$x.id) { $codes.Add(([string]$x.id).Trim()); continue }
  }

  $uniq = $codes | Where-Object { $_ -and $_.Length -gt 0 } | Select-Object -Unique
  if (-not $uniq) { return @() }
  return @($uniq | Sort-Object)
}

$u = Join-Url $BaseUrl "/api/internal/client-profiles"
Write-Host ("[INFO] GET " + $u) -ForegroundColor Cyan

$data = Get-Json $u
$codes = Extract-Codes $data

if (-not $codes -or $codes.Count -eq 0) {
  Write-Host "[ERR] could_not_extract_client_codes" -ForegroundColor Red
  exit 1
}

$content = ($codes -join "`n") + "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutFile, $content, $utf8NoBom)

Write-Host ("[OK] wrote " + $codes.Count + " clients to " + $OutFile) -ForegroundColor Green
$codes | ForEach-Object { Write-Host (" - " + $_) -ForegroundColor Green }

exit 0