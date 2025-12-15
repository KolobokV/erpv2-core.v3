param(
  [string]$ErpFront = "C:\Users\User\Desktop\ERP\ERPv2_front_stage1",
  [string]$ErpBack  = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect",
  [string]$GitRoot  = "C:\Users\User\Desktop\erpv2-core.v3"
)

$ErrorActionPreference = "Stop"

function Assert-Path([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw ("path_missing label=" + $Label + " path=" + $Path)
  }
}

function Read-Text([string]$Path) {
  try { return Get-Content -LiteralPath $Path -Raw -ErrorAction Stop } catch { return "" }
}

function Find-GitRoot([string]$Candidate) {
  if ($Candidate -and (Test-Path -LiteralPath (Join-Path $Candidate ".git"))) { return $Candidate }
  return $null
}

function Detect-Frontend([string]$Root) {
  $pkg = Join-Path $Root "package.json"
  $vite = Join-Path $Root "vite.config.ts"
  $src = Join-Path $Root "src"
  if ((Test-Path -LiteralPath $pkg) -and (Test-Path -LiteralPath $src)) {
    return @{
      root = $Root
      package_json = $pkg
      vite_config = (Test-Path -LiteralPath $vite)
    }
  }
  return $null
}

function Detect-Backend([string]$Root) {
  $appMain = Join-Path $Root "app\main.py"
  $venvAct = Join-Path $Root "venv\Scripts\Activate.ps1"
  if (Test-Path -LiteralPath $appMain) {
    return @{
      root = $Root
      app_main = $appMain
      venv_activate = (Test-Path -LiteralPath $venvAct)
    }
  }
  return $null
}

function Detect-GitFrontend([string]$GitRoot) {
  $cand = Join-Path $GitRoot "frontend"
  if (Test-Path -LiteralPath $cand) {
    $d = Detect-Frontend $cand
    if ($d) { return $d }
  }
  return $null
}

function NowIso() { return (Get-Date).ToString("o") }

# --- validate base candidates ---
Assert-Path $ErpFront "erp_front_candidate"
Assert-Path $ErpBack  "erp_back_candidate"
Assert-Path $GitRoot  "git_root_candidate"

$front = Detect-Frontend $ErpFront
if (-not $front) { throw ("frontend_not_detected root=" + $ErpFront) }

$back = Detect-Backend $ErpBack
if (-not $back) { throw ("backend_not_detected root=" + $ErpBack) }

$git = Find-GitRoot $GitRoot
if (-not $git) { throw ("git_not_detected root=" + $GitRoot) }

$gitFront = Detect-GitFrontend $GitRoot
if (-not $gitFront) {
  # still ok, but record null
  $gitFront = $null
}

# --- snapshot file target (inside backend tools) ---
$outDir = Join-Path $ErpBack "tools"
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outPath = Join-Path $outDir ("workdirs_snapshot_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".json")

$snapshot = [pscustomobject]@{
  created_at = (NowIso)
  erp = @{
    frontend_root = $front.root
    backend_root  = $back.root
  }
  git = @{
    root = $git
    frontend_root = $(if ($gitFront) { $gitFront.root } else { $null })
  }
  checks = @{
    erp_front_package_json = $front.package_json
    erp_back_app_main = $back.app_main
    git_has_dotgit = $true
    git_front_detected = $(if ($gitFront) { $true } else { $false })
  }
}

$json = $snapshot | ConvertTo-Json -Depth 8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outPath, $json + "`n", $utf8NoBom)

Write-Host "== workdirs snapshot ==" -ForegroundColor Cyan
Write-Host ("saved=" + $outPath) -ForegroundColor Green
Write-Host ("erp_front=" + $front.root) -ForegroundColor Green
Write-Host ("erp_back=" + $back.root) -ForegroundColor Green
Write-Host ("git_root=" + $git) -ForegroundColor Green
Write-Host ("git_front=" + $(if ($gitFront) { $gitFront.root } else { "null" })) -ForegroundColor Green

Write-Host "" 
Write-Host "== handoff block (copy) ==" -ForegroundColor Cyan
Write-Host "LIVE_FRONTEND=" -NoNewline
Write-Host $front.root
Write-Host "LIVE_BACKEND=" -NoNewline
Write-Host $back.root
Write-Host "GIT_ROOT=" -NoNewline
Write-Host $git
Write-Host "GIT_FRONTEND=" -NoNewline
Write-Host $(if ($gitFront) { $gitFront.root } else { "null" })
Write-Host "SNAPSHOT_FILE=" -NoNewline
Write-Host $outPath