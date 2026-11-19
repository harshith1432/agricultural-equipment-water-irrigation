# AgriSpectra Enterprise Backend Server Launcher
# Binds to 0.0.0.0:5050 (accessible on localhost and local LAN 192.168.0.116:5050)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   AGRISPECTRA FLOW & FIELD - ENTERPRISE BACKEND LAUNCHER  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green

$env:PORT = "5050"
$env:HOST = "0.0.0.0"
$env:NODE_ENV = "development"
$env:GOOGLE_APPLICATION_CREDENTIALS = "$PSScriptRoot\..\service-account.json"

Set-Location -Path "$PSScriptRoot\..\backend"
Write-Host "Starting Node.js Backend on port 5050..." -ForegroundColor Yellow
node server.js
