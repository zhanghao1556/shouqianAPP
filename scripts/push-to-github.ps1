param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"

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
  Write-Host "音翼AI售前工具 GitHub 上传助手" -ForegroundColor White
  Write-Host "仓库路径：$RepoPath"

  Write-Step "检查 GitHub 443 网络"
  $net = Test-NetConnection github.com -Port 443 -WarningAction SilentlyContinue
  if (-not $net.TcpTestSucceeded) {
    Write-Failure "网络未通：无法连接 github.com:443。请稍后再双击本脚本。"
    exit 2
  }
  Write-Host "网络已通：github.com:443" -ForegroundColor Green

  Write-Step "检查本地 Git 状态"
  git status -sb
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed with exit code $LASTEXITCODE"
  }

  $porcelain = git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "git status --porcelain failed with exit code $LASTEXITCODE"
  }
  if ($porcelain) {
    Write-Failure "存在未提交文件。为避免误上传，请先让 Codex 提交，或手动确认后再推送。"
    Write-Host $porcelain
    exit 3
  }

  Write-Step "上传到 GitHub"
  git push
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed with exit code $LASTEXITCODE"
  }

  Write-Step "确认同步状态"
  git status -sb
  if ($LASTEXITCODE -ne 0) {
    throw "final git status failed with exit code $LASTEXITCODE"
  }

  Write-Success "上传成功：本地 main 已同步到 GitHub。"
  exit 0
} catch {
  Write-Failure "上传失败：$($_.Exception.Message)"
  exit 1
} finally {
  if (-not $NoPause) {
    Write-Host ""
    Write-Host "按任意键关闭窗口..."
    try {
      $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
      Start-Sleep -Seconds 5
    }
  }
}
