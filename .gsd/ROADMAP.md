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
- Consolidated Native Infrastructure (Completed)
- C++ Orderbook & Math Engine implementation (Completed)
- JS/C++ High-performance bridge integration (Completed)

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

## Phase 6.5: Elite Intelligence Dashboard
**Goal**: Migrate EdgeFinder to a dedicated full-page experience with macro surprise meters.
- Create `IntelligencePage.tsx` and register in `settingsStore.ts`
- Implement `finnhub.ts` and `fred.ts` surprise math
- Build high-fidelity "Surprise Meter" UI components

## Phase 6.6: AI Geopolitical Intelligence
**Goal**: Integrate LLM-driven geopolitical risk analysis.
- Implement `gdelt.ts` (News) and `gemini.ts` (AI) adapters
- Integrate Geopolitical category into `intelligence.ts`
- Add Geopolitical Risk panel to `IntelligencePage.tsx`

## Phase 7: Terminus Candle Cache & Predictive Pre-Warm
**Goal**: Eliminate chart load latency with intelligent two-tier caching.
- Write executable plans (Completed)
- Fix initial partial implementation syntax errors (Completed)
- Integrate fetchHistorical cache-first logic in App.tsx (Completed)
- Verify end-to-end caching behavior (Completed)
