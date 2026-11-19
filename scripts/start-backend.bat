@echo off
REM AgriSpectra Enterprise Backend Server Launcher
echo ==========================================================
echo    AGRISPECTRA FLOW & FIELD - ENTERPRISE BACKEND LAUNCHER
echo ==========================================================
set PORT=5050
set HOST=0.0.0.0
set NODE_ENV=development
set GOOGLE_APPLICATION_CREDENTIALS=%~dp0..\service-account.json

cd /d "%~dp0..\backend"
echo Starting Node.js Backend on port 5050...
node server.js
