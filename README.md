# TERMINUS — Trading Intelligence Dashboard

Real-time BTC/USDT trading dashboard with orderbook depth, options flow (GEX, Max Pain), liquidation heatmaps, VWAF funding analysis, and confluence zone detection.

## Quick Start

```
Double-click start.bat
```

That's it. The script will:
1. Start Docker containers (TimescaleDB + Redis)
2. Install Node.js dependencies
3. Create `.env` config from template
4. Launch the server

## Manual Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install & run server
cd packages/server
npm install
cp .env.example .env    # Edit with your API keys
npx tsx src/index.ts
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://localhost:8080/health` | Health check (DB, Redis, exchanges) |
| `ws://localhost:8080/ws` | WebSocket for live data |

## Architecture

```
orderbook_liquidation/
├── start.bat                 # One-click startup
├── stop.bat                  # Clean shutdown
├── docker-compose.yml        # TimescaleDB + Redis
├── trading_dasboard.html     # Legacy simulation (reference)
└── packages/
    └── server/
        └── src/
            ├── index.ts          # Fastify server entry
            ├── config.ts         # Environment config (Zod)
            ├── logger.ts         # Structured logging (pino)
            ├── db/
            │   ├── timescale.ts   # PostgreSQL pool
            │   ├── redis.ts       # Redis + pub/sub
            │   └── migrate.ts     # Schema migrations
            ├── ws/
            │   ├── manager.ts     # Exchange WS multiplexer
            │   └── client-hub.ts  # Frontend pub/sub
            └── adapters/
                └── types.ts       # Normalized data schemas
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Fastify + WebSocket
- **Database**: TimescaleDB (PostgreSQL)
- **Cache**: Redis
- **Frontend**: *(Phase 2+)* Vite + React
