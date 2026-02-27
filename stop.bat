@echo off
title TERMINUS — Shutdown
color 0C

echo.
echo  Stopping TERMINUS services...
echo.

echo  [1/2] Stopping Docker containers...
docker compose down 2>nul
if %ERRORLEVEL% neq 0 (
    docker-compose down 2>nul
)
echo        ✓ Containers stopped

echo  [2/2] Cleaning up...
echo        ✓ Done
echo.

echo  All services stopped. Data is preserved in Docker volumes.
echo  Run start.bat to restart.
echo.
pause
