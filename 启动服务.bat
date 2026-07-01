@echo off
title Pet Bank Local Server
cd /d "%~dp0"
echo ============================================
echo   Pet Bank Local Server
echo   URL: http://127.0.0.1:8765/
echo   Close this window to stop the server
echo ============================================
echo Starting server, please wait...
ping -n 2 127.0.0.1 >nul
start "" http://127.0.0.1:8765/
python -m http.server 8765 --bind 127.0.0.1
echo Server stopped. Press any key to exit.
pause >nul
