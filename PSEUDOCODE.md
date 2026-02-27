# Terminus System Pseudocode Overview

This document provides a system-level pseudocode overview and architecture of the complete Terminus Orderbook & Liquidation Mapping Platform. The platform is divided into two main workspaces: `packages/server` and `packages/web`.

For folder-specific pseudocode, refer to:
- `packages/server/PSEUDOCODE.md`
- `packages/web/PSEUDOCODE.md`

## System Architecture Overview

```mermaid
graph TD;
    subgraph Data Sources
        Binance[Binance Streams]
        Deribit[Deribit Feed]
    end

    subgraph Backend Server (Node/Fastify)
        Adapters[Exchange Adapters]
        Engines[Analytics Engines]
        Redis[(Redis Cache/PubSub)]
        Timescale[(TimescaleDB)]
        WS_HUB[WebSocket Client Hub]
        
        Adapters --> Engines
        Engines --> Redis
        Redis --> WS_HUB
    end

    subgraph Frontend Client (React)
        Zustand[Market Store]
        Chart[Lightweight Charts]
        Panels[Analytics Panels]
        
        WS_HUB --> Zustand
        Zustand --> Chart
        Zustand --> Panels
    end
    
    Data Sources --> Adapters
```

## System Data Flow Pseudocode

```javascript
// 1. DATA INGESTION (Backend)
WHILE Server is Running:
    Listen to Binance WebSockets (Depth, Trades)
    Listen to REST Polling (Open Interest, Funding)
    Parse incoming messages
    Update local running calculation buffers

// 2. ANALYTICS ENGINES (Backend)
ON Analytics Engine Tick (Every X ms):
    Calculate Advanced Metrics:
        - OptionsEngine: compute GEX arrays and regime
        - LiquidationEngine: map liquidation heatmaps based on price
        - VWAFEngine: calculate volumne weighted average funding
        - ConfluenceEngine: identify price nodes where multiple alerts intersect
    Write computed payload to Redis
    Broadcast computed payload via WebSocket to all connected clients

// 3. STATE MANAGEMENT (Frontend)
ON WebSocket Message Received:
    Parse Payload
    Update Global Zustand `useMarketStore`:
        IF message.topic == 'liquidations': 
            store.liquidations = message.data
        IF message.topic == 'options':
            store.optionsAnalytics = message.data
        IF message.topic == 'aggTrade':
            update latest candlestick and push active volume
            
// 4. RENDER (Frontend)
ON Zustand Store State Change:
    Trigger React Renders
    Chart Component updates native Lightweight Chart Dataset
    Sidebar Panels extract data and visualize:
        e.g., Options Panel renders flex-boxes proportionally styled to GEX volume
```

## Technology Stack Architecture
- **Web App**: React, Typescript, Vite, Zustand (State), TradingView Lightweight Charts
- **Server**: Node.js, Fastify, TypeScript, `@fastify/websocket`
- **Infrastructure**: Redis (real-time queue/caching), TimescaleDB (historical retention)
- **UI System**: Vanilla CSS with comprehensive token-based design system (`index.css`), eliminating utility clashing constraints.
