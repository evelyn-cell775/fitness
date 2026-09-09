
@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -Command "Write-Host '未找到 Python，请到 python.org 下载安装（安装时勾选 Add to PATH）'"
  pause
  exit /b
)
powershell -NoProfile -Command "Write-Host ''; Write-Host '====== 本机 IP 地址 ======'; (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*'}).IPAddress; Write-Host '=========================='; Write-Host ''; Write-Host '手机连同一个 WiFi，浏览器打开：'; Write-Host 'http://上面的IP:8630'; Write-Host ''; Write-Host '用完后直接关闭本窗口即可'; Write-Host ''"
python -m http.server 8630
pause
