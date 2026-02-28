#!/bin/bash
# Start TERMINUS

echo -e "\033[0;32m"
echo " ╔══════════════════════════════════════════════════════════╗"
echo " ║          TERMINUS — Trading Intelligence Dashboard       ║"
echo " ║                                                          ║"
echo " ║  Orderbook · Options Flow · Liquidations · VWAF · GEX    ║"
echo " ╚══════════════════════════════════════════════════════════╝"
echo -e "\033[0m"

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    exit 1
fi

echo "[1/5] Starting Docker infrastructure (TimescaleDB + Redis)..."
if ! docker compose up -d --wait 2>/dev/null; then
    if ! docker-compose up -d 2>/dev/null; then
        echo "[ERROR] Failed to start Docker containers."
        exit 1
    fi
fi
echo "      ✓ TimescaleDB & Redis running"
echo ""

echo "[2/5] Installing server dependencies..."
cd packages/server || exit
if [ ! -d "node_modules" ]; then
    npm install --silent 2>/dev/null
    echo "      ✓ Dependencies installed"
else
    echo "      ✓ Dependencies already installed"
fi
echo ""

echo "[3/5] Checking environment config..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "      ✓ Created .env from .env.example"
    fi
else
    echo "      ✓ .env already exists"
fi
echo ""

echo "[4/5] Installing frontend dependencies..."
cd ../web || exit
if [ ! -d "node_modules" ]; then
    npm install --silent 2>/dev/null
    echo "      ✓ Frontend dependencies installed"
else
    echo "      ✓ Frontend dependencies already installed"
fi
cd ../server || exit
echo ""

echo "[5/5] Starting TERMINUS..."
echo " ┌──────────────────────────────────────────────────────────┐"
echo " │  Backend:   http://localhost:8080                        │"
echo " │  Frontend:  http://localhost:5173                        │"
echo " │  Health:    http://localhost:8080/health                 │"
echo " │                                                          │"
echo " │  Press Ctrl+C to stop                                    │"
echo " └──────────────────────────────────────────────────────────┘"
echo ""

cd ../web || exit
npx vite --host > /dev/null 2>&1 &
PID_VITE=$!
cd ../server || exit

(sleep 3 && (open http://localhost:5173 || xdg-open http://localhost:5173) 2>/dev/null) &

trap "echo 'Shutting down...'; kill $PID_VITE 2>/dev/null; cd ../..; docker compose stop 2>/dev/null; docker-compose stop 2>/dev/null; exit 0" SIGINT SIGTERM

npx tsx src/index.ts
