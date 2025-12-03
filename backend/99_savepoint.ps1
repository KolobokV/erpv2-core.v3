param(
    [string]$Source    = ".",
    [string]$OutDir    = ".\_savepoints",
    [string]$NamePrefix = "savepoint"
)

$ErrorActionPreference = "Stop"

function Info($m){ Write-Host "== $m ==" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

# 1) Нормализуем корневую папку
$root = (Resolve-Path $Source).ProviderPath
$rootName = Split-Path $root -Leaf
Info "Scanning $root ..."

# 2) Готовим каталог для сейвов
if (!(Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
    Ok "Created directory: $OutDir"
}
$OutDirAbs = (Resolve-Path $OutDir).ProviderPath

# 3) Имя архива
$ts = Get-Date -Format yyyyMMdd_HHmmss
$zipPath = Join-Path $OutDirAbs ("{0}_{1}_{2}.zip" -f $NamePrefix, $rootName, $ts)

# 4) Правила исключения
$exclude = @(
    '(^|\\)\.git(\\|$)',
    '(^|\\)node_modules(\\|$)',
    '(^|\\)__pycache__(\\|$)',
    '(^|\\)_savepoints(\\|$)',
    '(^|\\)db_data(\\|$)',
    '(^|\\)doli_docs(\\|$)'
)

function IsExcluded([string]$rel){
    foreach ($p in $exclude) {
        if ([System.Text.RegularExpressions.Regex]::IsMatch(
            $rel,
            $p,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )) {
            return $true
        }
    }
    return $false
}

# 5) Список файлов
$files = Get-ChildItem -Path $root -Recurse -File -Force | Where-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\')
    -not (IsExcluded $rel)
}

Info ("Files to archive: {0}" -f $files.Count)
Info "Creating archive: $zipPath"

# 6) Подгружаем сборки
Add-Type -AssemblyName System.IO.Compression    | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null

# 7) Создаём ZIP в режиме Create (1)
$fs = $null
$zip = $null
$added = 0
$totalBytes = 0

try {
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    # Создаём новый файл
    $fs = New-Object System.IO.FileStream($zipPath, [System.IO.FileMode]::CreateNew)

    # ВАЖНО: 1 = Create (а не 0 = Read)
    $zip = New-Object System.IO.Compression.ZipArchive($fs, 1)

    foreach ($f in $files) {
        $rel = $f.FullName.Substring($root.Length).TrimStart('\')

        $entry = $zip.CreateEntry($rel)
        $es = $entry.Open()

        try {
            $src = [System.IO.File]::OpenRead($f.FullName)
            try {
                $src.CopyTo($es)
            } finally {
                $src.Dispose()
            }
        } finally {
            $es.Dispose()
        }

        $added++
        $totalBytes += $f.Length

        if (($added % 200) -eq 0) {
            Info ("Added files: {0}" -f $added)
        }
    }
}
finally {
    if ($zip -ne $null) { $zip.Dispose() }
    if ($fs -ne $null) { $fs.Dispose() }
}

Ok ("Done. Files archived: {0}" -f $added)
Ok ("Total bytes: {0}" -f $totalBytes)
Ok ("Savepoint created: {0}" -f $zipPath)
