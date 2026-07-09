@echo off
setlocal
set "ROOT=%~dp0"
pwsh -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\push-to-github.ps1" -RepoPath "%ROOT%"
if errorlevel 1 (
  exit /b %errorlevel%
)
exit /b 0
