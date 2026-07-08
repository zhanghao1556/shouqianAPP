$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$services = @(
  @{ Name = "main app"; Script = "dev"; Port = 5174; Url = "http://127.0.0.1:5174/" },
  @{ Name = "point calibration"; Script = "dev:calibration"; Port = 5175; Url = "http://127.0.0.1:5175/" },
  @{ Name = "wiring topology calibration"; Script = "dev:wiring-calibration"; Port = 5176; Url = "http://127.0.0.1:5176/" }
)

function Test-Page {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Stop-StaleProjectVite {
  param([int]$Port)

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -like "*$projectRoot*" -and $process.CommandLine -like "*vite*") {
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}

Set-Location $projectRoot

foreach ($service in $services) {
  if (-not (Test-Page -Url $service.Url)) {
    Stop-StaleProjectVite -Port $service.Port
    Start-Process -FilePath "npm.cmd" `
      -ArgumentList @("run", $service.Script) `
      -WorkingDirectory $projectRoot `
      -WindowStyle Hidden
  }
}

$deadline = (Get-Date).AddSeconds(45)
$pending = @($services)
do {
  Start-Sleep -Milliseconds 750
  $pending = @($pending | Where-Object { -not (Test-Page -Url $_.Url) })
} while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline)

foreach ($service in $services) {
  if (Test-Page -Url $service.Url) {
    Start-Process $service.Url
  }
}

$pending = @($services | Where-Object { -not (Test-Page -Url $_.Url) })

if ($pending.Count -gt 0) {
  Write-Host ""
  Write-Host "Some pages did not start:"
  foreach ($service in $pending) {
    Write-Host "- $($service.Url)"
  }
  Write-Host ""
  Write-Host "Please send Codex this window text if it still cannot open."
  Read-Host "Press Enter to close"
}
