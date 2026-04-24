@echo off
setlocal
title Raindrop.io App
cd /d "%~dp0"

echo [Raindrop.io App] Starting...
where npm >nul 2>nul
if errorlevel 1 (
    echo [Raindrop.io App] npm not found. Please install it.
    pause
    exit /b 1
)

npm run local

if errorlevel 1 (
    echo [Raindrop.io App] Exited with error code %errorlevel%.
    pause
)
endlocal
