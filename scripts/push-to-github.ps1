param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$exitCode = 0

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Success($Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Green
}

function Write-Failure($Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
}

try {
  Set-Location -LiteralPath $RepoPath
  Write-Host "GitHub upload helper" -ForegroundColor White
  Write-Host "Repo: $RepoPath"

  Write-Step "Checking github.com:443"
  $net = Test-NetConnection github.com -Port 443 -WarningAction SilentlyContinue
  if (-not $net.TcpTestSucceeded) {
    Write-Failure "Network is not ready: cannot connect to github.com:443."
    $exitCode = 2
  } else {
    Write-Host "Network OK: github.com:443" -ForegroundColor Green

    Write-Step "Checking git status"
    git status -sb
    if ($LASTEXITCODE -ne 0) {
      throw "git status failed with exit code $LASTEXITCODE"
    }

    $porcelain = git status --porcelain
    if ($LASTEXITCODE -ne 0) {
      throw "git status --porcelain failed with exit code $LASTEXITCODE"
    }

    if ($porcelain) {
      Write-Failure "Uncommitted files found. Commit them before uploading."
      Write-Host $porcelain
      $exitCode = 3
    } else {
      Write-Step "Pushing to GitHub"
      git push
      if ($LASTEXITCODE -ne 0) {
        throw "git push failed with exit code $LASTEXITCODE"
      }

      Write-Step "Final git status"
      git status -sb
      if ($LASTEXITCODE -ne 0) {
        throw "final git status failed with exit code $LASTEXITCODE"
      }

      Write-Success "Upload succeeded. Local main is synced to GitHub."
    }
  }
} catch {
  Write-Failure "Upload failed: $($_.Exception.Message)"
  $exitCode = 1
}

if (-not $NoPause) {
  Write-Host ""
  Read-Host "Press Enter to close this window"
}

exit $exitCode
