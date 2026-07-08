param(
  [Parameter(Mandatory = $false)]
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

$status = git status --porcelain
if (-not $status) {
  Write-Host "Working tree clean. Nothing to commit."
  exit 0
}

if (-not $Message.Trim()) {
  $Message = "checkpoint $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host "Current changes:"
git status -sb

git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "No staged changes after git add."
  exit 0
}

git commit -m $Message
git push

Write-Host "Checkpoint pushed:"
git log --oneline --decorate -1
