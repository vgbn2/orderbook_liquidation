# Terminus Backend Pseudocode Overview

This document provides a high-level pseudocode overview of the `packages/server` directory.

## 1. Entry Point (`src/index.ts`)
```typescript
FUNCTION start_server():
    Initialize Fastify Application
    Register Plugins (CORS, WebSocket)
    
    Connect to Redis (Main and Sub)
    Connect to TimescaleDB (verify health)
    Run Database Migrations
    
    Register HTTP Routes (OHLCV APIs)
    
    Connect Exchange Adapters:
        binanceAdapter.connect()
        binanceAdapter.fetchHistoricalKlines(globalSymbol)
        binanceAdapter.connectOrderbook()
        binanceAdapter.connectTrades()
        binanceAdapter.startPollingFundingAndOI()
        
    Initialize and Start Analytics Engines:
        quantEngine.start()
        alertsEngine.setSpot()
        optionsEngine.startBroadcast()
        liquidationEngine.startBroadcast()
        vwafEngine.startBroadcast()
        confluenceEngine.startBroadcast()
        
    Setup Periodic Simulation/Calculation Intervals:
        Every 20s: Update simulated options chain
        Every 10s: Update simulated funding rates (VWAF)
        Every 4s: Update Confluence zones based on options, liquidations, and VWAF
        Random Intervals: Simulate large trades and liquidations
        
    Setup Health Endpoint (/health):
        Return status of DB, Redis, Exchanges, and connected WS clients
        
    Setup WebSocket Connection Endpoint (/ws):
        ON CLIENT CONNECT:
            Add client to clientHub
            Send initial initial state snapshot from Redis to client
            
        ON CLIENT MESSAGE:
            IF message == 'start_replay':
                replayEngine.startSession(clientId, config)
            IF message == 'switch_symbol':
                Switch globalSymbol
                Reconnect binance adapters for new symbol
                Reset all engines for new symbol
                Broadcast 'symbol_changed' to all clients
                
    Start listening on PORT
    
ON SHUTDOWN_SIGNAL:
    Stop Fastify App
    Stop all Engines
    Disconnect Exchange Adapters
    Close Database Connections
    Exit process
```

## 2. Analytics Engines (`src/engines/`)

### Options Engine (`options.ts`)
```typescript
CLASS OptionsEngine:
    STATE: currentSpot, simulatedChain

    FUNCTION startBroadcast():
        Run interval every X seconds:
            Compute GEX (Gamma Exposure), DEX (Delta), VEX (Vega)
            Format options analytics payload
            clientHub.broadcast("options.analytics", payload)
            Cache payload in Redis
```

### Liquidations Engine (`liquidations.ts`)
```typescript
CLASS LiquidationEngine:
    STATE: recentEvents, heatmap
    
    FUNCTION addEvent(event):
        Push event to recentEvents
        Update heatmap clusters based on liquidation price
        
    FUNCTION startBroadcast():
        Run interval every X seconds:
            Format liquidations payload (heatmap, recent)
            clientHub.broadcast("liquidations", payload)
            Cache payload in Redis
```

### Confluence Engine (`confluence.ts`)
```typescript
CLASS ConfluenceEngine:
    STATE: spot, optionsData, liquidationHeatmap, vwafData
    
    FUNCTION calculateZones():
        Identify price zones where multiple metrics align (e.g., High GEX + Liquidation Nodes)
        Assign conviction score 
        
    FUNCTION startBroadcast():
        Run interval every X seconds:
            Calculate overlapping zones
            clientHub.broadcast("confluence", zones)
            Cache zones in Redis
```

### Additional Engines
- **VWAF Engine (`vwaf.ts`)**: Calculates Volume Weighted Average Funding.
- **Quant Engine (`quant.ts`)**: Runs macro condition analysis (Risk On/Off).
- **Alerts Engine (`alerts.ts`)**: Detects anomalies and triggers system alerts based on confluence logic.
- **Replay Engine (`replay.ts`)**: Streams historical candlestick and trade data to specific connected clients for market replay.

## 3. Exchange Adapters (`src/adapters/`)
```typescript
CLASS BinanceAdapter:
    FUNCTION connect():
        Initialize WebSocket connections to Binance Streams
        
    FUNCTION connectOrderbook():
        Subscribe to `depth` stream
        On Message: Compute bid/ask resting liquidity walls => Cache in Redis
        
    FUNCTION connectTrades():
        Subscribe to `aggTrade` stream
        On Message: Calculate CVD (Cumulative Volume Delta) => Cache in Redis
        
    FUNCTION startPolling():
        Set interval:
            Fetch Open Interest and Funding Rates via REST
            Store in Redis and Broadcast to clientHub
```

## 4. Database & Websocket (`src/db/` & `src/ws/`)
- **Redis (`db/redis.ts`)**: Connection utilities and caching layers. Maintains realtime states.
- **TimescaleDB (`db/timescale.ts`)**: Historical persistent storage.
- **WS Client Hub (`ws/client-hub.ts`)**: Manages connected UI clients and broadcasts pub/sub topics to frontend.
