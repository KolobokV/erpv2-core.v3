$ErrorActionPreference = "Stop"
function Say($t){ Write-Host ("[ " + (Get-Date).ToString("HH:mm:ss") + " ] " + $t) }
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

$apiKeyFile = "init\api_key.txt"
if(-not (Test-Path $apiKeyFile)){ throw "API key file not found at init\api_key.txt. Run 01_up.ps1 first." }
$api = Get-Content $apiKeyFile -Raw

$base = "http://localhost:8282/api/index.php"
$headers = @{ DOLAPIKEY = $api.Trim() }

Say "GET /users?limit=1"
try { (Invoke-WebRequest "$base/users?limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 10).Content | Out-Host } catch { Write-Host $_.Exception.Message }

Say "GET /thirdparties?limit=1"
try { (Invoke-WebRequest "$base/thirdparties?limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 10).Content | Out-Host } catch { Write-Host $_.Exception.Message }

Say "GET /products?limit=1"
try { (Invoke-WebRequest "$base/products?limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 10).Content | Out-Host } catch { Write-Host $_.Exception.Message }

Say "GET /invoices?limit=1"
try { (Invoke-WebRequest "$base/invoices?limit=1" -Headers $headers -UseBasicParsing -TimeoutSec 10).Content | Out-Host } catch { Write-Host $_.Exception.Message }
