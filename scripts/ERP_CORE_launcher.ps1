Param(
    [ValidateSet("up", "down", "restart", "build_front", "smoke", "deep_smoke")]
    [string]$Action = "smoke"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "== ERP CORE launcher v3.4 =="

# Root folder (C:\Users\User\Desktop\ERP)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir   = $scriptDir

$stackDir  = Join-Path $rootDir "ERPv2_stack_stage3_5"
$frontDir  = Join-Path $rootDir "ERPv2_front_stage1"

$composeFile       = Join-Path $stackDir "docker-compose.yml"
$frontBuildScript  = Join-Path $frontDir "scripts\01_build_front_image.ps1"
$frontendImageName = "erpv2_front:latest"

function Test-DockerAvailable {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Docker CLI is not available in PATH." -ForegroundColor Red
        exit 1
    }
    try {
        docker version > $null 2>&1
    }
    catch {
        Write-Host "[ERROR] Docker is not running or not accessible." -ForegroundColor Red
        exit 1
    }
}

function Invoke-HttpCheck {
    Param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [switch]$WarnOnly
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
        if ($resp.StatusCode -eq $ExpectedStatus) {
            Write-Host "[OK] $Name => $($resp.StatusCode)" -ForegroundColor Green
            return $true
        }
        else {
            $msg = "[WARN] $Name => $($resp.StatusCode)"
            if ($WarnOnly) {
                Write-Host $msg -ForegroundColor Yellow
                return $false
            }
            else {
                Write-Host $msg -ForegroundColor Red
                return $false
            }
        }
    }
    catch {
        $msg = "[WARN] $Name => $($_.Exception.Message)"
        if ($WarnOnly) {
            Write-Host $msg -ForegroundColor Yellow
        }
        else {
            Write-Host $msg -ForegroundColor Red
        }
        return $false
    }
}

function Invoke-HealthCheck {
    Param(
        [switch]$WarnOnly
    )

    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -Method GET -TimeoutSec 8
        if ($resp -and $resp.status -eq "ok") {
            Write-Host "[OK] API HEALTH => 200" -ForegroundColor Green
            return $true
        }
        else {
            $msg = "[WARN] API HEALTH => unexpected response"
            if ($WarnOnly) {
                Write-Host $msg -ForegroundColor Yellow
            }
            else {
                Write-Host $msg -ForegroundColor Red
            }
            return $false
        }
    }
    catch {
        $msg = "[WARN] API HEALTH => $($_.Exception.Message)"
        if ($WarnOnly) {
            Write-Host $msg -ForegroundColor Yellow
        }
        else {
            Write-Host $msg -ForegroundColor Red
        }
        return $false
    }
}

function Ensure-FrontImage {
    Param(
        [string]$ImageName = $frontendImageName
    )

    Write-Host "[INFO] Checking frontend image: $ImageName"
    $existing = docker images $ImageName --format "{{.Repository}}:{{.Tag}}" 2>$null
    if (-not $existing) {
        Write-Host "[INFO] Image not found, building..."
        if (-not (Test-Path $frontBuildScript)) {
            Write-Host "[ERROR] Frontend build script not found at $frontBuildScript" -ForegroundColor Red
            exit 1
        }
        & powershell -ExecutionPolicy Bypass -File $frontBuildScript -ImageName $ImageName
    }
    else {
        Write-Host "[OK] Frontend image exists: $existing" -ForegroundColor Green
    }
}

if (-not (Test-Path $stackDir)) {
    Write-Host "[ERROR] Stack directory not found: $stackDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $composeFile)) {
    Write-Host "[ERROR] docker-compose.yml not found at: $composeFile" -ForegroundColor Red
    exit 1
}

Test-DockerAvailable

switch ($Action) {

    "build_front" {
        Write-Host "[INFO] Action: BUILD_FRONT" -ForegroundColor Cyan
        Ensure-FrontImage
        Write-Host "[OK] Frontend image ready." -ForegroundColor Green
        break
    }

    "up" {
        Write-Host "[INFO] Action: UP (start stack)" -ForegroundColor Cyan
        Ensure-FrontImage

        Push-Location $stackDir
        try {
            docker compose -f $composeFile up -d --build
            Write-Host "[OK] Stack started" -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
        Write-Host "[OK] Done." -ForegroundColor Green
        break
    }

    "down" {
        Write-Host "[INFO] Action: DOWN (stop stack)" -ForegroundColor Cyan
        Push-Location $stackDir
        try {
            docker compose -f $composeFile down
            Write-Host "[OK] Stack stopped" -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
        Write-Host "[OK] Done." -ForegroundColor Green
        break
    }

    "restart" {
        Write-Host "[INFO] Action: RESTART (recreate stack)" -ForegroundColor Cyan
        Ensure-FrontImage

        Push-Location $stackDir
        try {
            docker compose -f $composeFile down
            docker compose -f $composeFile up -d --build
            Write-Host "[OK] Stack restarted" -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
        Write-Host "[OK] Done." -ForegroundColor Green
        break
    }

    "smoke" {
        Write-Host "[INFO] Running basic smoke tests..." -ForegroundColor Cyan

        $ok = $true
        $ok = $ok -and (Invoke-HttpCheck  -Name "FRONT"      -Url "http://localhost:5173/"           -ExpectedStatus 200)
        $ok = $ok -and (Invoke-HealthCheck)
        $ok = $ok -and (Invoke-HttpCheck  -Name "API CONFIG" -Url "http://localhost:8000/api/config" -ExpectedStatus 200)
        $ok = $ok -and (Invoke-HttpCheck  -Name "API TASKS"  -Url "http://localhost:8000/api/tasks"  -ExpectedStatus 200)

        if ($ok) {
            Write-Host "[OK] Smoke tests passed." -ForegroundColor Green
            exit 0
        }
        else {
            Write-Host "[WARN] Smoke tests finished with warnings or errors." -ForegroundColor Yellow
            exit 1
        }
    }

    "deep_smoke" {
        Write-Host "[INFO] Running deep smoke tests..." -ForegroundColor Cyan

        $ok = $true

        # Front via nginx
        $ok = $ok -and (Invoke-HttpCheck -Name "FRONT" -Url "http://localhost:5173/" -ExpectedStatus 200)

        # Core backend
        $ok = $ok -and (Invoke-HealthCheck -WarnOnly)
        $ok = $ok -and (Invoke-HttpCheck -Name "API CONFIG" -Url "http://localhost:8000/api/config" -ExpectedStatus 200)
        $ok = $ok -and (Invoke-HttpCheck -Name "API TASKS"  -Url "http://localhost:8000/api/tasks"  -ExpectedStatus 200)

        # Internal processes: informational only, do not affect $ok
        Invoke-HttpCheck -Name "API INTERNAL DEFINITIONS" -Url "http://localhost:8000/api/internal/process-definitions" -ExpectedStatus 200 -WarnOnly | Out-Null
        Invoke-HttpCheck -Name "API INTERNAL INSTANCES"   -Url "http://localhost:8000/api/internal/process-instances"   -ExpectedStatus 200 -WarnOnly | Out-Null

        if ($ok) {
            Write-Host "[OK] Deep smoke tests passed." -ForegroundColor Green
            exit 0
        }
        else {
            Write-Host "[WARN] Deep smoke finished with problems." -ForegroundColor Yellow
            exit 1
        }
    }
}
