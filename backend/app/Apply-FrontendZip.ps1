param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = "Stop"

$LIVE_FRONTEND = "C:\Users\User\Desktop\ERP\ERPv2_front_stage1"
$GIT_FRONTEND  = "C:\Users\User\Desktop\erpv2-core.v3\frontend"

$SAFE_IO = "C:\Users\User\Desktop\ERP\ERPv2_backend_connect\tools\erp_safe_io.ps1"
. $SAFE_IO

if (-not (Test-Path -LiteralPath $ZipPath)) {
  throw "Zip not found: $ZipPath"
}

$Tmp = Join-Path $env:TEMP ("erpv2_zip_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Tmp | Out-Null

try {
  Write-Host "[INFO] Extracting zip..."
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $Tmp -Force

  $files = @(Get-ChildItem $Tmp -Recurse -File)
  if ($files.Length -eq 0) {
    throw "Zip archive is empty"
  }

  foreach ($f in $files) {
    $rel = $f.FullName.Substring($Tmp.Length).TrimStart("\")
    if (-not $rel.StartsWith("src\")) {
      continue
    }

    $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8

    $liveTarget = Join-Path $LIVE_FRONTEND $rel
    $gitTarget  = Join-Path $GIT_FRONTEND  $rel

    Write-Host "[WRITE] $rel"
    New-SafeTextFile $liveTarget $content
    New-SafeTextFile $gitTarget  $content
  }

  Write-Host "[OK] Frontend zip applied successfully"
}
finally {
  Remove-Item -Recurse -Force -Path $Tmp
}