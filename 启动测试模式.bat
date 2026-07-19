@echo off
title Pet Bank Test Mode
cd /d "%~dp0"
echo ============================================
echo   Pet Bank Local Test Mode
echo   URL: http://127.0.0.1:7001/app
echo   Registration and login are not required.
echo   Close this window to stop the server.
echo ============================================
echo Starting test mode, please wait...
ping -n 2 127.0.0.1 >nul
start "" http://127.0.0.1:7001/app
node scripts/test-mode-server.mjs
echo Test mode stopped. Press any key to exit.
pause >nul
