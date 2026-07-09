@echo off
setlocal
set "ROOT=%~dp0"

set "PS_EXE=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=%ProgramFiles(x86)%\PowerShell\7\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.3.0_x64__8wekyb3d8bbwe\pwsh.exe"
if not exist "%PS_EXE%" for /d %%P in ("%ProgramFiles%\WindowsApps\Microsoft.PowerShell_*_x64__8wekyb3d8bbwe") do if exist "%%P\pwsh.exe" set "PS_EXE=%%P\pwsh.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\push-to-github.ps1" -RepoPath "%ROOT%"
if errorlevel 1 (
  echo.
  echo 上传脚本执行失败，错误码：%errorlevel%
  echo 如果上面显示网络未通或 GitHub 连接失败，请网络恢复后再双击。
  echo.
  pause
  exit /b %errorlevel%
)
echo.
pause
exit /b 0
