param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..")),
  [switch]$NoPause
)

$ErrorActionPreference = "Stop"
$exitCode = 0

function Write-Title($Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor White
}

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok($Message) {
  Write-Host $Message -ForegroundColor Green
}

function Write-Warn($Message) {
  Write-Host $Message -ForegroundColor Yellow
}

function Write-Bad($Message) {
  Write-Host $Message -ForegroundColor Red
}

try {
  Set-Location -LiteralPath $RepoPath
  Write-Title "GitHub 上传助手"
  Write-Host "项目目录：$RepoPath"

  Write-Step "1. 检查网络"
  $net = Test-NetConnection github.com -Port 443 -WarningAction SilentlyContinue
  if (-not $net.TcpTestSucceeded) {
    Write-Warn "网络未通：无法连接 github.com:443。"
    Write-Warn "本次不会上传。网络恢复后请重新双击这个脚本。"
    $exitCode = 2
  } else {
    Write-Ok "网络已通：github.com:443 可以连接。"

    Write-Step "2. 检查本地 Git 状态"
    git status -sb
    if ($LASTEXITCODE -ne 0) {
      throw "git status 执行失败，退出码 $LASTEXITCODE"
    }

    $porcelain = git status --porcelain
    if ($LASTEXITCODE -ne 0) {
      throw "git status --porcelain 执行失败，退出码 $LASTEXITCODE"
    }

    if ($porcelain) {
      Write-Bad "发现未提交文件。为避免误上传，本次不会执行 git push。"
      Write-Host ""
      foreach ($line in $porcelain) {
        Write-Host $line
      }
      Write-Host ""
      Write-Warn "请先让 Codex 提交这些改动，或你手动确认后再上传。"
      $exitCode = 3
    } else {
      Write-Step "3. 上传到 GitHub"
      git push
      if ($LASTEXITCODE -ne 0) {
        throw "git push 执行失败，退出码 $LASTEXITCODE"
      }

      Write-Step "4. 确认同步结果"
      git status -sb
      if ($LASTEXITCODE -ne 0) {
        throw "最终 git status 执行失败，退出码 $LASTEXITCODE"
      }

      Write-Ok "上传成功：本地 main 已同步到 GitHub。"
    }
  }
} catch {
  Write-Bad "上传失败：$($_.Exception.Message)"
  Write-Warn "请保留这个窗口内容，发给 Codex 继续排查。"
  $exitCode = 1
}

if (-not $NoPause) {
  Write-Host ""
  Read-Host "按 Enter 关闭窗口"
}

exit $exitCode
