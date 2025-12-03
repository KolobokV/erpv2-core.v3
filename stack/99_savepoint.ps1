param(
  [string]$Source = "C:\Users\User\Desktop\ERP\ERPv2_stack_stage2",
  [string]$OutDir = ".\_savepoints"
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}

function Info($m){ Write-Host ("== {0} ==" -f $m) -ForegroundColor Cyan }
function Ok($m){ Write-Host ("[OK] {0}" -f $m) -ForegroundColor Green }
function Warn($m){ Write-Warning $m }
function Fail($m){ Write-Host ("[FAIL] {0}" -f $m) -ForegroundColor Red }

if (-not (Test-Path -LiteralPath $Source)) { Fail ("Source folder not found: {0}" -f $Source); exit 1 }

if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  Ok ("Created directory: {0}" -f $OutDir)
}

# Normalize helper: to lowercase and forward slashes
function Normalize-Path([string]$p) {
  return ([IO.Path]::GetFullPath($p)).ToLower().Replace('\','/')
}

# Exclusion using simple contains/wildcards (no regex)
$excludes = @(
  "/.git/",
  "/_savepoints/",
  "/db_data/",
  "/doli_docs/",
  "/node_modules/",
  "/__pycache__/"
)

function Is-Excluded([string]$fullPath) {
  $n = Normalize-Path $fullPath
  foreach ($e in $excludes) {
    if ($n.Contains($e)) { return $true }
  }
  return $false
}

$sourceNorm = Normalize-Path $Source
Info ("Scanning {0} ..." -f $Source)
$files = Get-ChildItem -LiteralPath $Source -Recurse -Force |
         Where-Object { -not $_.PSIsContainer -and -not (Is-Excluded $_.FullName) }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName   = "savepoint_stack_stage2_{0}.zip" -f $timestamp
$zipPath   = Join-Path $OutDir $zipName

# .NET zip API
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

Info ("Creating archive: {0}" -f $zipPath)
$fs = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
try {
  $archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $true)
  try {
    $level = [System.IO.Compression.CompressionLevel]::Optimal
    $added = 0
    $totalBytes = 0L

    foreach ($f in $files) {
      # build entry name relative to $Source
      $full = [IO.Path]::GetFullPath($f.FullName)
      $entryName = $full.Substring($sourceNorm.Length).TrimStart('\','/').Replace('\','/')

      $entry = $archive.CreateEntry($entryName, $level)

      $inStream  = [System.IO.File]::OpenRead($full)
      $outStream = $entry.Open()
      try {
        $inStream.CopyTo($outStream)
        $totalBytes += $inStream.Length
      } finally {
        $outStream.Dispose()
        $inStream.Dispose()
      }

      $added++
      if (($added % 500) -eq 0) { Info ("Added files: {0}" -f $added) }
    }

    Ok ("Done. Files: {0}, total bytes: {1:N0}" -f $added, $totalBytes)
  } finally {
    $archive.Dispose()
  }
} finally {
  $fs.Dispose()
}

$zipSize = (Get-Item -LiteralPath $zipPath).Length
Ok ("Savepoint created: {0} ({1:N0} bytes)" -f $zipPath, $zipSize)
