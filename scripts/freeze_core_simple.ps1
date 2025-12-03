param(
    [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$ErrorActionPreference = "Stop"

Write-Host "== Simple ERP CORE freeze v3.1 =="

if (-not (Test-Path $Root)) {
    Write-Host "[ERR] Root path does not exist: $Root"
    exit 1
}

$savepointsDir = Join-Path $Root "_savepoints"
if (-not (Test-Path $savepointsDir)) {
    New-Item -ItemType Directory -Path $savepointsDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "ERP_CORE_simple_{0}.zip" -f $timestamp
$finalArchivePath = Join-Path $savepointsDir $archiveName
$tempArchivePath  = Join-Path $env:TEMP $archiveName

Write-Host "[INFO] Root: $Root"
Write-Host "[INFO] Final archive: $finalArchivePath"
Write-Host "[INFO] Temp archive:  $tempArchivePath"

# ------------------------------------------------------------
# Smoke test before freeze
# ------------------------------------------------------------
Write-Host "[STEP] Running smoke test before freeze..."
try {
    & (Join-Path $Root "ERP_CORE_launcher.ps1") smoke
    Write-Host "[OK] Smoke test passed"
}
catch {
    Write-Host "[WARN] Smoke test finished with errors: $($_.Exception.Message)"
    Write-Host "[WARN] Continuing freeze anyway."
}

# ------------------------------------------------------------
# Collect items to archive (without node_modules, .vite, .git, huge files)
# ------------------------------------------------------------

Write-Host "[STEP] Collecting items for archive..."

# Note: _backups removed to avoid very large files inside simple freeze.
$includeRelative = @(
    "ERPv2_backend_connect",
    "ERPv2_front_stage1",
    "ERPv2_stack_stage3_5",
    "ERP_Doli17_PresetAdmin_DockerHubOnly",
    "_savepoints",
    "ERP_CORE_launcher.ps1",
    "freeze_core_simple.ps1",
    "restore_core_simple.ps1"
)

$pathsToScan = @()

foreach ($rel in $includeRelative) {
    $p = Join-Path $Root $rel
    if (Test-Path $p) {
        $pathsToScan += $p
    }
}

$items = @()

foreach ($p in $pathsToScan) {
    if (Test-Path $p -PathType Container) {
        $items += Get-ChildItem -Path $p -Recurse -File | Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\\.vite\\" -and
            $_.FullName -notmatch "\\\.git\\"
        }
    }
    elseif (Test-Path $p -PathType Leaf) {
        $items += Get-Item $p
    }
}

if (-not $items -or $items.Count -eq 0) {
    Write-Host "[ERR] No items collected for archive. Aborting."
    exit 1
}

# Filter out very large files that can break Compress-Archive (> ~1.5 GB)
$maxSizeBytes = 1500000000

$tooLarge = $items | Where-Object { $_.Length -ge $maxSizeBytes }
if ($tooLarge -and $tooLarge.Count -gt 0) {
    Write-Host "[WARN] Some files are larger than $maxSizeBytes bytes and will be skipped:"
    foreach ($f in $tooLarge) {
        Write-Host ("       - {0} ({1} bytes)" -f $f.FullName, $f.Length)
    }

    $items = $items | Where-Object { $_.Length -lt $maxSizeBytes }
}

if (-not $items -or $items.Count -eq 0) {
    Write-Host "[ERR] After filtering large files there is nothing to archive. Aborting."
    exit 1
}

Write-Host ("[INFO] Files to archive: {0}" -f $items.Count)

# ------------------------------------------------------------
# Create archive
# ------------------------------------------------------------

if (Test-Path $tempArchivePath) {
    Remove-Item $tempArchivePath -Force
}

Write-Host "[STEP] Creating zip archive into temp..."
Compress-Archive -Path $items.FullName -DestinationPath $tempArchivePath -Force

Write-Host "[STEP] Moving archive to _savepoints..."
if (Test-Path $finalArchivePath) {
    Remove-Item $finalArchivePath -Force
}

Move-Item $tempArchivePath $finalArchivePath

Write-Host "[OK] Freeze created:"
Write-Host "  $finalArchivePath"
