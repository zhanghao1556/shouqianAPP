@echo off
setlocal
set "ROOT=C:\Users\73921\Documents\Codex\2026-06-24\shouqianAPP"
set "SCRIPT=%ROOT%\scripts\push-to-github.ps1"

set "PS_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=%ProgramFiles(x86)%\PowerShell\7\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.3.0_x64__8wekyb3d8bbwe\pwsh.exe"
if not exist "%PS_EXE%" for /d %%P in ("%ProgramFiles%\WindowsApps\Microsoft.PowerShell_*_x64__8wekyb3d8bbwe") do if exist "%%P\pwsh.exe" set "PS_EXE=%%P\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

if not exist "%SCRIPT%" (
  echo.
  echo Upload script not found: %SCRIPT%
  echo Please check whether the project folder was moved.
  echo.
  pause
  exit /b 1
)

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -RepoPath "%ROOT%"
if errorlevel 1 (
  echo.
  echo Upload script failed. Exit code: %errorlevel%
  echo If the window says network or GitHub failed, try again later.
  echo.
  pause
  exit /b %errorlevel%
)
echo.
pause
exit /b 0
