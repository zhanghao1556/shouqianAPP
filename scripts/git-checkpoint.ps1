param(
  [Parameter(Mandatory = $false)]
  [string]$Message = "",

  [Parameter(Mandatory = $false)]
  [ValidateSet("checkpoint", "daily", "release")]
  [string]$Kind = "checkpoint"
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

$status = git status --porcelain
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

if (-not $Message.Trim()) {
  switch ($Kind) {
    "daily" { $Message = "daily checkpoint $timestamp" }
    "release" { $Message = "release checkpoint $timestamp" }
    default { $Message = "checkpoint $timestamp" }
  }
}

if (-not $status) {
  if ($Kind -in @("daily", "release")) {
    Write-Host "Working tree clean. Creating $Kind archive checkpoint."
    git commit --allow-empty -m $Message
    if ($LASTEXITCODE -ne 0) {
      throw "git commit failed with exit code $LASTEXITCODE"
    }
    git push
    if ($LASTEXITCODE -ne 0) {
      throw "git push failed with exit code $LASTEXITCODE"
    }
    Write-Host "Checkpoint pushed:"
    git log --oneline --decorate -1
    exit 0
  }

  Write-Host "Working tree clean. Nothing to commit."
  exit 0
}

Write-Host "Current changes:"
git status -sb

git add -A
if ($LASTEXITCODE -ne 0) {
  throw "git add failed with exit code $LASTEXITCODE"
}

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "No staged changes after git add."
  exit 0
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  throw "git commit failed with exit code $LASTEXITCODE"
}
git push
if ($LASTEXITCODE -ne 0) {
  throw "git push failed with exit code $LASTEXITCODE"
}

Write-Host "Checkpoint pushed:"
git log --oneline --decorate -1
