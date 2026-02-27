@echo off
title TERMINUS — Trading Intelligence Dashboard
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║          TERMINUS — Trading Intelligence Dashboard      ║
echo  ║                                                          ║
echo  ║  Orderbook · Options Flow · Liquidations · VWAF · GEX   ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ── Check prerequisites ──────────────────────────────────────
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Docker is not installed or not in PATH.
    echo          Download: https://docs.docker.com/desktop/install/windows/
    echo.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo          Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: ── Start Docker infrastructure ──────────────────────────────
echo  [1/5] Starting Docker infrastructure (TimescaleDB + Redis)...
docker compose up -d --wait 2>nul
if %ERRORLEVEL% neq 0 (
    docker-compose up -d 2>nul
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] Failed to start Docker containers.
        echo          Make sure Docker Desktop is running.
        echo.
        pause
        exit /b 1
    )
)
echo        ✓ TimescaleDB running on port 5432
echo        ✓ Redis running on port 6379
echo.

:: ── Install server dependencies ──────────────────────────────
echo  [2/5] Installing server dependencies...
cd packages\server
if not exist node_modules (
    call npm install --silent 2>nul
    echo        ✓ Dependencies installed
) else (
    echo        ✓ Dependencies already installed (skipping)
)
echo.

:: ── Create .env if missing ───────────────────────────────────
echo  [3/5] Checking environment config...
if not exist .env (
    copy .env.example .env >nul
    echo        ✓ Created .env from .env.example
    echo        ⚠ Edit .env to add your API keys (Deribit, Coinglass)
) else (
    echo        ✓ .env already exists
)
echo.

:: ── Install frontend dependencies ────────────────────────────
echo  [4/5] Installing frontend dependencies...
cd ..\web
if not exist node_modules (
    call npm install --silent 2>nul
    echo        ✓ Frontend dependencies installed
) else (
    echo        ✓ Frontend dependencies already installed (skipping)
)
cd ..\server
echo.

:: ── Start everything ─────────────────────────────────────────
echo  [5/5] Starting TERMINUS...
echo.
echo  ┌──────────────────────────────────────────────────────────┐
echo  │  Backend:   http://localhost:8080                        │
echo  │  Frontend:  http://localhost:5173                        │
echo  │  Health:    http://localhost:8080/health                 │
echo  │                                                          │
echo  │  Press Ctrl+C to stop                                    │
echo  └──────────────────────────────────────────────────────────┘
echo.

:: ── Start frontend dev server in background ──────────────────
cd ..\web
start /b cmd /c "npx vite --host 2>nul"
cd ..\server

:: ── Open browser after a short delay ─────────────────────────
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: ── Start backend (foreground, keeps console open) ───────────
call npx tsx src/index.ts

:: ── Cleanup on exit ──────────────────────────────────────────
echo.
echo  Shutting down...
cd ..\..
docker compose stop 2>nul
echo  Done. Goodbye.
pause
