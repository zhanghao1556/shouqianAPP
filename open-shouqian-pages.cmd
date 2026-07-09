@echo off
setlocal
set "ROOT=C:\Users\73921\Documents\Codex\2026-06-24\shouqianAPP"
set "SCRIPT=%ROOT%\scripts\open-local-pages.ps1"
set "PS_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=%ProgramFiles(x86)%\PowerShell\7\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.3.0_x64__8wekyb3d8bbwe\pwsh.exe"
if not exist "%PS_EXE%" for /d %%P in ("%ProgramFiles%\WindowsApps\Microsoft.PowerShell_*_x64__8wekyb3d8bbwe") do if exist "%%P\pwsh.exe" set "PS_EXE=%%P\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

if not exist "%SCRIPT%" (
  echo.
  echo 启动脚本不存在：%SCRIPT%
  echo 请确认项目目录是否移动。
  echo.
  pause
  exit /b 1
)

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
if errorlevel 1 (
  echo.
  echo 启动失败，请把这个窗口内容发给 Codex。
  pause
  exit /b %errorlevel%
)
exit /b 0
