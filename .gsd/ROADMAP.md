# ROADMAP — Execution Phases

## Phase 1: Infrastructure Stability & API Debugging
**Goal**: Stabilize backend APIs and research charting foundation.
- Fix TimescaleDB migration and Redis connection (Completed)
- Resolve 500 errors on `/api/token` and `/api/ohlcv` (Completed)
- Research Lightweight Charts architecture (Completed)

## Phase 2: Architectural UI Redesign & Engine Fixes
**Goal**: Move main panels to floating architecture and fix major engine bugs.
- Create utils/safe.ts (Completed)
- Create FloatingQuantPanel, FloatingLiquidationPanel, FloatingOptionsPanel
- Fix LiquidationPanel crash and QuantPanel missing distributions (Completed)
- Fix Replay Engine pause button (Completed)
- Fix Orderbook Symbol switching and state corruption (Completed)

## Phase 3: Core Features & Algorithms
**Goal**: Implement the business logic for trading signals.
- Implement Asset Capability Map (Completed)
- Implement Grade Algorithm (TerminalSummaryPanel) (Completed)
- Implement significantLiquidations tracking (Completed)
- Remove unused Trade menu (Completed)

## Phase 4: Performance & C++ Port
**Goal**: Rewrite Quant Engine in C++ for ultra-low latency.
- Planning phase (Next)

## Phase 5: Gap Closure
**Goal**: Address gaps from milestone audit
- Fix timeframe switching medium (Completed)

## Phase 6: Multi-Factor Signal Intelligence
**Goal**: Implement high-intelligence buy/sell signals.
- Research Sentiment & Macro data (Completed)
- Implement Fear & Greed / AAII scraper (Completed)
- Implement FRED API integration (Completed)
- Implement RSI, SMA (20, 50, 100) and Volume Distribution logic (Completed)
- Build Multi-factor Decision Engine (Decision Grade) (Completed)
- Bridge EdgeFinder to TerminalSummaryPanel UI (Completed)
