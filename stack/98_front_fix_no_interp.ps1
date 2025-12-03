param(
  [string]C:\Users\User\Desktop\ERP\ERPv2_front_stage1 = "C:\Users\User\Desktop\ERP\ERPv2_front_stage1",
  [string]http://host.docker.internal:8000  = "http://host.docker.internal:8000"
)
\Stop = "Stop"
function Ok(\){ Write-Host "[OK] \" -ForegroundColor Green }
function Info(\){ Write-Host "== \ ==" -ForegroundColor Cyan }

\ = Join-Path \C:\Users\User\Desktop\ERP\ERPv2_front_stage1 "nginx.conf"
if(-not (Test-Path \)){ throw "nginx.conf not found: \" }

\ = @'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.11 valid=30s ipv6=off;

    location / {
        try_files \ \/ /index.html;
    }

    location = /api/health {
        proxy_pass __API_BASE__/health;
        proxy_http_version 1.1;
        proxy_set_header Host \System.Management.Automation.Internal.Host.InternalHost;
        proxy_set_header X-Real-IP \;
        proxy_set_header X-Forwarded-Proto \;
        proxy_set_header X-Forwarded-For \;
        proxy_redirect off;
    }

    location = /api/config {
        proxy_pass __API_BASE__/config;
        proxy_http_version 1.1;
        proxy_set_header Host \System.Management.Automation.Internal.Host.InternalHost;
        proxy_set_header X-Real-IP \;
        proxy_set_header X-Forwarded-Proto \;
        proxy_set_header X-Forwarded-For \;
        proxy_redirect off;
    }

    location /api/ {
        proxy_pass __API_BASE__/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \System.Management.Automation.Internal.Host.InternalHost;
        proxy_set_header X-Real-IP \;
        proxy_set_header X-Forwarded-Proto \;
        proxy_set_header X-Forwarded-For \;
        proxy_redirect off;
    }
}
'@
\ = \.Replace('__API_BASE__', \http://host.docker.internal:8000)
\ = New-Object System.Text.UTF8Encoding(\False)
[System.IO.File]::WriteAllText(\, \, \)
Ok "nginx.conf rewritten (UTF-8 no BOM)"

Push-Location \C:\Users\User\Desktop\ERP\ERPv2_front_stage1
try {
  Info "compose down"
  docker compose down --remove-orphans | Out-Null
  Info "compose build --no-cache"
  docker compose build --no-cache | Out-Null
  Info "compose up -d"
  docker compose up -d | Out-Null
} finally { Pop-Location }
