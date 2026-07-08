$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$ports = @(5174, 5175)

foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -like "*$projectRoot*" -and $process.CommandLine -like "*vite*") {
      Stop-Process -Id $listener.OwningProcess -Force
    }
  }
}

Set-Location $projectRoot
npm run dev
