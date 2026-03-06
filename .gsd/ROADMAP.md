# ROADMAP — Execution Phases

## Phase 1: Infrastructure Stability & API Debugging
**Goal**: Stabilize backend APIs and research charting foundation.
- Fix TimescaleDB migration and Redis connection (Completed)
- Resolve 500 errors on `/api/token` and `/api/ohlcv` (Completed)
- Research Lightweight Charts architecture (Completed)

## Phase 2: Architectural UI Redesign & Engine Fixes
**Goal**: Move main panels to floating architecture and fix major engine bugs.
- Create utils/safe.ts
- Create FloatingQuantPanel, FloatingLiquidationPanel, FloatingOptionsPanel
- Fix LiquidationPanel crash and QuantPanel missing distributions
- Fix Replay Engine pause button

## Phase 3: Core Features & Algorithms
**Goal**: Implement the business logic for trading signals.
- Implement Asset Capability Map
- Implement Grade Algorithm (TerminalSummaryPanel)
- Implement significantLiquidations tracking

## Phase 4: Performance & C++ Port (Future)
**Goal**: Rewrite Quant Engine in C++ for ultra-low latency.
