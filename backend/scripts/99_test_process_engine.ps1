param(
    [string]$BaseUrl = "http://localhost:8000"
)

Write-Host "== Testing internal process engine =="

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Url,
        [object]$BodyObject = $null
    )

    try {
        if ($BodyObject -ne $null) {
            $bodyJson = $BodyObject | ConvertTo-Json -Depth 10
            $response = Invoke-WebRequest -Method $Method -Uri $Url -ContentType "application/json" -Body $bodyJson
        }
        else {
            $response = Invoke-WebRequest -Method $Method -Uri $Url
        }
    }
    catch {
        Write-Host "[ERROR] Request failed: $Method $Url"
        Write-Host $_
        return $null
    }

    if (-not $response.Content) {
        return $null
    }

    try {
        return $response.Content | ConvertFrom-Json
    }
    catch {
        Write-Host "[WARN] Failed to parse JSON from $Url"
        Write-Host $response.Content
        return $null
    }
}

# 0) Load instances (with auto-init if needed)

$instancesUrl = "$BaseUrl/api/internal/process-instances"

Write-Host "[0] Loading process instances..."
$instances = Invoke-Json -Method "GET" -Url $instancesUrl
if (-not $instances) {
    $instances = @()
}

if ($instances.Count -eq 0) {
    Write-Host "[0] No process instances found. Trying to run 98_init_process_engine.ps1..."

    $initScript = Join-Path $PSScriptRoot "98_init_process_engine.ps1"
    if (Test-Path $initScript) {
        powershell -ExecutionPolicy Bypass -File $initScript -BaseUrl $BaseUrl
    }
    else {
        Write-Host "[WARN] 98_init_process_engine.ps1 not found at $initScript"
    }

    Write-Host "[0] Reloading process instances after init..."
    $instances = Invoke-Json -Method "GET" -Url $instancesUrl
    if (-not $instances) {
        $instances = @()
    }
}

if ($instances.Count -eq 0) {
    Write-Host "[0] Still no process instances available. Nothing to test."
    Write-Host "== DONE (no instances) =="
    exit 0
}

# 1) Pick first instance

$instance = $instances[0]
$instanceId = "$($instance.id)"

Write-Host "[1] Using instance id: $instanceId"

$instanceUrl = "$BaseUrl/api/internal/process-instances/$instanceId"
$genUrl      = "$BaseUrl/api/internal/process-instances/$instanceId/generate-tasks"
$tasksUrl    = "$BaseUrl/api/internal/process-instances/$instanceId/tasks"

# 2) Check instance before generation

Write-Host "[2] Checking instance before generation..."
$before = Invoke-Json -Method "GET" -Url $instanceUrl
if ($before -ne $null) {
    $before | ConvertTo-Json -Depth 10
}
else {
    Write-Host "[2] Failed to load instance before generation."
}

# 3) Run generation

Write-Host "[3] Generating tasks for instance..."
$genResult = Invoke-Json -Method "POST" -Url $genUrl

if ($genResult -eq $null) {
    Write-Host "[3] Generation request failed or returned empty response."
}
else {
    Write-Host "[3] Generation result:"
    $genResult | ConvertTo-Json -Depth 10
}

# 4) Check instance after generation

Write-Host "[4] Checking instance after generation..."
$after = Invoke-Json -Method "GET" -Url $instanceUrl
if ($after -ne $null) {
    $after | ConvertTo-Json -Depth 10
}
else {
    Write-Host "[4] Failed to load instance after generation."
}

# 5) Check tasks for instance via tasks endpoint

Write-Host "[5] Reading tasks for instance via /tasks endpoint..."
$tasks = Invoke-Json -Method "GET" -Url $tasksUrl

if ($tasks -eq $null) {
    Write-Host "[5] Failed to read tasks for instance."
}
else {
    Write-Host "[5] Tasks payload:"
    $tasks | ConvertTo-Json -Depth 10
}

Write-Host "== DONE =="
exit 0
