param(
    [string]$ArchivePath,
    [string]$TargetRoot = "."
)

$ErrorActionPreference = "Stop"

Write-Host "== Restore ERP CORE from simple freeze =="

if (-not (Test-Path $ArchivePath)) {
    throw "Archive not found: $ArchivePath"
}

$archiveFull = Resolve-Path $ArchivePath
Write-Host "[INFO] Archive: $archiveFull"

# Resolve target directory
$targetFull = Resolve-Path $TargetRoot -ErrorAction SilentlyContinue
if (-not $targetFull) {
    New-Item -ItemType Directory -Path $TargetRoot | Out-Null
    $targetFull = Resolve-Path $TargetRoot
}

Write-Host "[INFO] Target root: $targetFull"

# Ensure target directory is empty
$items = Get-ChildItem -LiteralPath $targetFull -Force -ErrorAction SilentlyContinue
if ($items -and $items.Count -gt 0) {
    throw "Target directory is not empty. Use empty folder for restore."
}

Write-Host "[STEP] Expanding archive..."
Expand-Archive -Path $archiveFull -DestinationPath $targetFull -Force

# After expand, launcher should be inside target root
$launcherPath = Join-Path $targetFull "ERP_CORE_launcher.ps1"
if (-not (Test-Path $launcherPath)) {
    Write-Host "[WARN] ERP_CORE_launcher.ps1 not found after restore. Skipping up/smoke."
    Write-Host "== Restore done =="
    return
}

Write-Host "[STEP] Starting stack (up)..."
powershell -ExecutionPolicy Bypass -File $launcherPath -Action up

Write-Host "[STEP] Running smoke test..."
powershell -ExecutionPolicy Bypass -File $launcherPath -Action smoke

Write-Host "[OK] Restore completed and stack is up."
Write-Host "== Done =="
