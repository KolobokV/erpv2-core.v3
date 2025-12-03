param(
    [string]$Src = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2_restored",
    [string]$Dst = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage3_connect"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }

if (!(Test-Path $Src)) { throw "Нет исходной папки: $Src" }
if (Test-Path $Dst)   { throw "Папка уже существует: $Dst" }

Info "Копирую $Src -> $Dst (без _savepoints, node_modules, __pycache__, .git)"
New-Item -ItemType Directory -Force -Path $Dst | Out-Null

$excludeMasks = @(
    "\_savepoints",
    "\node_modules",
    "\__pycache__",
    "\.git"
)

$items = Get-ChildItem -Path $Src -Recurse -Force

foreach($item in $items){
    $rel = $item.FullName.Substring($Src.Length).TrimStart('\')

    $skip = $false
    foreach($mask in $excludeMasks){
        if ($rel -like "*$mask*"){
            $skip = $true
            break
        }
    }
    if ($skip){ continue }

    $target = Join-Path $Dst $rel

    if ($item.PSIsContainer){
        if (!(Test-Path $target)){
            New-Item -ItemType Directory -Force -Path $target | Out-Null
        }
    } else {
        $dir = Split-Path $target
        if (!(Test-Path $dir)){
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        Copy-Item $item.FullName $target -Force
    }
}

Ok "Клон готов: $Dst"
