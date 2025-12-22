Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-SafeTextFile {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )

  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $tmp = [System.IO.Path]::GetTempFileName()

  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($tmp, $Content, $utf8NoBom)

    Move-Item -Path $tmp -Destination $Path -Force
    Write-Host "[OK] Text file created: $Path"
    return 0
  } catch {
    Write-Host "[ERROR] Failed to write: $Path"
    throw
  } finally {
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  }
}