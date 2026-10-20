@echo off
cd /d "%~dp0"
echo Starting BhuVista at http://localhost:3000
where node >nul 2>nul || (echo Please install Node.js 20+ from https://nodejs.org & pause & exit /b 1)
start "" http://localhost:3000
node server.js
pause
