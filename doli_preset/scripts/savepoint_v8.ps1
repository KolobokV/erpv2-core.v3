Param(
  [string]$Source=".",
  [string]$OutDir=".\_savepoints"
)
$ErrorActionPreference="Stop"

# ??? ??????
$dt = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "ERP_Doli17_PresetAdmin_DockerHubOnly_$dt.zip"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$zipPath = Join-Path $OutDir $zipName

# ??????? ?????????? (wildcard, ?? regex)
$excludeLike = @(
  "*\._*"            # ??????? ???.?????, ???? ?????
  "*\.git\*",
  "*\_savepoints\*",
  "*\db_data\*",
  "*\doli_docs\*",
  "*\node_modules\*",
  "*\__pycache__\*"
)

# ????????? ?????
$tmp = Join-Path $env:TEMP ("sp_" + [guid]::NewGuid())
Copy-Item $Source $tmp -Recurse -Force

# ??????? ??????????? ???? (?? -like)
Get-ChildItem -Path $tmp -Recurse -Force | Where-Object {
  $p = $_.FullName
  foreach($mask in $excludeLike){
    if ($p -like $mask) { return $true }
  }
  return $false
} | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# ????????
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $zipPath)

# ?????? ????????? ?????
Remove-Item $tmp -Recurse -Force

Write-Host "Savepoint created:`n$zipPath"
