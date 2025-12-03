param([string]$FrontUrl = "http://localhost:5173")
$ErrorActionPreference = "Stop"
function Ok($m){ Write-Host "[OK] $m" -ForegroundColor Green }
function Warn($m){ Write-Warning $m }

function Hit($url){
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 8
    Ok ("{0} => {1}" -f $url, [int]$r.StatusCode)
  } catch {
    Warn ("{0} => {1}" -f $url, $_.Exception.Message)
  }
}

Hit "$FrontUrl/"
Hit "$FrontUrl/api/health"
Hit "$FrontUrl/api/config"
Hit "$FrontUrl/api/tasks"
Hit "$FrontUrl/api/tasks/today"
Hit "$FrontUrl/api/tasks/report/today_by_assignee"
Hit "$FrontUrl/api/tasks/export"
