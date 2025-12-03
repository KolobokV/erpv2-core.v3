param(
    [string]$ErpRoot  = "C:\Users\User\Desktop\ERP",
    [string]$RepoRoot = "C:\Users\User\Desktop\erpv2-core.v3"
)

$ErrorActionPreference = "Stop"

Write-Host "== Prepare erpv2-core.v3 from ERP root =="

if (-not (Test-Path $ErpRoot)) {
    Write-Host "[ERR] ERP root not found: $ErpRoot"
    exit 1
}

if (-not (Test-Path $RepoRoot)) {
    Write-Host "[ERR] Repo root not found: $RepoRoot"
    exit 1
}

# Create basic structure in repo
$backendDir   = Join-Path $RepoRoot "backend"
$frontendDir  = Join-Path $RepoRoot "frontend"
$stackDir     = Join-Path $RepoRoot "stack"
$doliDir      = Join-Path $RepoRoot "doli_preset"
$scriptsDir   = Join-Path $RepoRoot "scripts"

$dirs = @($backendDir, $frontendDir, $stackDir, $doliDir, $scriptsDir)

foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d | Out-Null
    }
}

function Copy-FolderClean {
    param(
        [string]$Source,
        [string]$Destination,
        [string[]]$ExcludeDirs = @(),
        [string[]]$ExcludeFiles = @()
    )

    if (-not (Test-Path $Source)) {
        Write-Host "[WARN] Source folder not found, skip: $Source"
        return
    }

    Write-Host "[INFO] Copying from $Source to $Destination"

    $xd = @()
    foreach ($dir in $ExcludeDirs) {
        $xd += @("/XD", $dir)
    }

    $xf = @()
    foreach ($file in $ExcludeFiles) {
        $xf += @("/XF", $file)
    }

    $args = @($Source, $Destination, "/E") + $xd + $xf

    $result = Start-Process -FilePath "robocopy.exe" -ArgumentList $args -NoNewWindow -PassThru -Wait
    $code = $result.ExitCode

    if ($code -gt 3) {
        Write-Host "[WARN] robocopy returned exit code $code for $Source -> $Destination"
    }
}

# ------------------------------------------------------------
# Backend
# ------------------------------------------------------------

$srcBackend = Join-Path $ErpRoot "ERPv2_backend_connect"
Copy-FolderClean `
    -Source $srcBackend `
    -Destination $backendDir `
    -ExcludeDirs @("_savepoints", "node_modules", ".git", "__pycache__", ".pytest_cache") `
    -ExcludeFiles @("app.db", ".env", "*.pyc", "*.pyo", "*.log")

# ------------------------------------------------------------
# Frontend
# ------------------------------------------------------------

$srcFrontend = Join-Path $ErpRoot "ERPv2_front_stage1"
Copy-FolderClean `
    -Source $srcFrontend `
    -Destination $frontendDir `
    -ExcludeDirs @("node_modules", ".git", ".vite", "dist", "build") `
    -ExcludeFiles @("package-lock.json.tmp", "*.log")

# ------------------------------------------------------------
# Stack
# ------------------------------------------------------------

$srcStack = Join-Path $ErpRoot "ERPv2_stack_stage3_5"
Copy-FolderClean `
    -Source $srcStack `
    -Destination $stackDir `
    -ExcludeDirs @(".git", "_savepoints") `
    -ExcludeFiles @("*.log")

# ------------------------------------------------------------
# Dolibarr preset
# ------------------------------------------------------------

$srcDoli = Join-Path $ErpRoot "ERP_Doli17_PresetAdmin_DockerHubOnly"
Copy-FolderClean `
    -Source $srcDoli `
    -Destination $doliDir `
    -ExcludeDirs @(".git", "_savepoints") `
    -ExcludeFiles @("*.log")

# ------------------------------------------------------------
# Root scripts
# ------------------------------------------------------------

$rootScripts = @(
    "ERP_CORE_launcher.ps1",
    "freeze_core_simple.ps1",
    "restore_core_simple.ps1"
)

foreach ($fileName in $rootScripts) {
    $srcFile = Join-Path $ErpRoot $fileName
    if (Test-Path $srcFile) {
        $dstFile = Join-Path $scriptsDir $fileName
        Write-Host "[INFO] Copy script $fileName"
        Copy-Item -Path $srcFile -Destination $dstFile -Force
    }
    else {
        Write-Host "[WARN] Script not found in ERP root: $fileName"
    }
}

Write-Host "== Done. Repo structure is prepared =="
Write-Host "Backend : $backendDir"
Write-Host "Frontend: $frontendDir"
Write-Host "Stack   : $stackDir"
Write-Host "Doli    : $doliDir"
Write-Host "Scripts : $scriptsDir"
