param(
    [string]$BaseUrl = "http://localhost:8000"
)

Write-Host "== Init internal process engine demo data =="

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
        throw
    }

    if (-not $response.Content) {
        return $null
    }

    try {
        return $response.Content | ConvertFrom-Json
    }
    catch {
        Write-Host "[WARN] Failed to parse JSON from $Url"
        return $null
    }
}

# 1) Ensure definition "Monthly Closing" exists

$defsUrl = "$BaseUrl/api/internal/process-definitions"

Write-Host "[1] Loading existing process definitions..."
$defs = Invoke-Json -Method "GET" -Url $defsUrl
if (-not $defs) {
    $defs = @()
}

$existingDef = $null
foreach ($d in $defs) {
    if ($d.name -eq "Monthly Closing") {
        $existingDef = $d
        break
    }
}

if ($existingDef) {
    Write-Host "[1] Reusing existing definition 'Monthly Closing' with id $($existingDef.id)..."
    $definitionId = "$($existingDef.id)"
}
else {
    Write-Host "[1] Creating new process definition 'Monthly Closing'..."

    $payload = @{
        name        = "Monthly Closing"
        description = "Basic monthly accounting workflow"
        scope       = "accounting"
        period_type = "monthly"
        stages      = @(
            @{
                id                            = "collect_bank"
                title                         = "Collect bank statements"
                order                         = 1
                description                   = "Request statements for the period"
                default_deadline_offset_days  = 0
            },
            @{
                id                            = "collect_docs"
                title                         = "Collect primary documents"
                order                         = 2
                description                   = "Request all primary documents"
                default_deadline_offset_days  = 2
            },
            @{
                id                            = "reconciliation"
                title                         = "Perform reconciliation"
                order                         = 3
                description                   = "Reconcile accounts and verify balances"
                default_deadline_offset_days  = 5
            }
        )
        meta        = @{}
    }

    $createdDef = Invoke-Json -Method "POST" -Url $defsUrl -BodyObject $payload
    if (-not $createdDef) {
        throw "Failed to create process definition (no response)"
    }

    $definitionId = "$($createdDef.id)"
    Write-Host "[1] Created definition id: $definitionId"
}

# 2) Ensure instance for demo client and period exists

$instancesUrl = "$BaseUrl/api/internal/process-instances"

Write-Host "[2] Loading existing process instances..."
$instances = Invoke-Json -Method "GET" -Url $instancesUrl
if (-not $instances) {
    $instances = @()
}

$targetClient = "client_demo_01"
$targetPeriod = "2025-11"

$existingInstance = $null
foreach ($inst in $instances) {
    if (("$($inst.definition_id)" -eq $definitionId) -and
        ($inst.client_id -eq $targetClient) -and
        ($inst.period -eq $targetPeriod)) {
        $existingInstance = $inst
        break
    }
}

if ($existingInstance) {
    Write-Host "[2] Reusing existing process instance id $($existingInstance.id)..."
    $instanceId = "$($existingInstance.id)"
}
else {
    Write-Host "[2] Creating new process instance for definition id $definitionId..."

    $payloadInst = @{
        definition_id = $definitionId
        client_id     = $targetClient
        period        = $targetPeriod
        status        = "planned"
        meta          = @{}
        tasks         = @()
    }

    $createdInst = Invoke-Json -Method "POST" -Url $instancesUrl -BodyObject $payloadInst
    if (-not $createdInst) {
        throw "Failed to create process instance (no response)"
    }

    $instanceId = "$($createdInst.id)"
    Write-Host "[2] Created instance id: $instanceId"
}

Write-Host "== Init done =="
Write-Host "Definition id: $definitionId"
Write-Host "Instance id  : $instanceId"
