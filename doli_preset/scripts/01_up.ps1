Param([switch]$NoPull)
$ErrorActionPreference = "Stop"
function Say($t){ Write-Host ("[ " + (Get-Date).ToString("HH:mm:ss") + " ] " + $t) }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

if(-not $NoPull){ Say "docker compose pull ..."; docker compose pull }

Say "docker compose up -d ..."
docker compose up -d

# ждём веб
$url = "http://localhost:8282/"
for($i=1; $i -le 120; $i++){
  try{
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ Say ("Dolibarr responded {0}" -f $r.StatusCode); break }
  } catch { Start-Sleep -Seconds 2 }
  if($i -eq 120){ throw "Dolibarr did not become ready at $url" }
}

$cid = (docker compose ps -q dolibarr)
if(-not $cid){ throw "Dolibarr container not found (service 'dolibarr')" }

Say ("Running post-init inside container {0} ..." -f $cid)
docker compose exec -T dolibarr php /var/www/html/custom/init/post_init_enable_and_seed.php | Out-Host

$apiKeyPath = Join-Path (Join-Path $scriptDir "..") "init\api_key.txt"
if(Test-Path $apiKeyPath){
  $api = Get-Content $apiKeyPath -Raw
  Say ("API key saved to init\api_key.txt : {0}" -f $api.Trim())
} else {
  Say "WARNING: api_key.txt not found."
}

Say "Open http://localhost:8282"
Say "Login standard: admin / ChangeThisAdmin!"
Say "Login superuser: Admin! / Admin123! (fallback AdminNew)"
