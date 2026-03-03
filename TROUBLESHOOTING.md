# Comprehensive Troubleshooting Log (Retrospective)

This log documents all major technical blockers, regressions, and architectural fixes since the inception of the Phase 9 hybrid transition (approx. March 2026).

---

## 🏗️ Backend & Infrastructure

### 1. Zombie Node.js Processes (`EADDRINUSE: 8080`)
- **Problem:** Server fails to start with `address already in use 0.0.0.0:8080`. Frontend CPU usage spikes to 100% due to aggressive retry loops.
- **Fix:** Terminate the ghost process manually using PowerShell.
- **Why:** Windows does not always kill child processes when a batch script or terminal is closed, leaving the port "locked."
- **How:** 
  1. `Get-NetTCPConnection -LocalPort 8080`
  2. `Stop-Process -Id <PID> -Force`
- **Section:** Deployment / Runtime

### 2. Conflicting Redis Ports (`ECONNREFUSED: 6380`)
- **Problem:** Logs show `AggregateError [ECONNREFUSED]` for Redis on port 6380.
- **Fix:** Purge redundant `REDIS_PORT` entries from `.env` and standardize on `6379`.
- **Why:** The `.env` file contained two different port definitions, causing the server to gamble on the wrong one.
- **How:** Deleted `REDIS_PORT=6380` from `packages/server/.env`.
- **Section:** Backend Configuration

### 3. Redundant Alert System Fatigue
- **Problem:** Terminal and UI alerts were "straining" the user experience and slowing down the main data path.
- **Fix:** Permanent removal of the alerts engine from the backend bootstrap.
- **Why:** The alerts were creating unnecessary noise and extra JSON stringification cycles on every price tick.
- **How:** Removed `alertsEngine` initialization and broadcast loops from `index.ts`.
- **Section:** System Cleanliness

---

## ⚙️ C++ Native Core (Native Addon)

### 4. Compiler Path Missing (`cl.exe` Not Found)
- **Problem:** `node-gyp rebuild` fails with "cl.exe not in PATH."
- **Fix:** Use the **x64 Native Tools Command Prompt for VS**.
- **Why:** The native build system requires specific MSVC environment variables that standard PowerShell/CMD lack.
- **How:** Open the VS developer prompt and run `npx node-gyp rebuild` in the `src/native` directory.
- **Section:** Native Build System

### 5. `ingestor.hpp` Structural Failure
- **Problem:** C++ core failed to compile due to mismatched curly braces and orphaned "for" loops.
- **Fix:** Clean code refactor of the `MarketIngestor` class.
- **Why:** Multiple rapid edits to the header files resulted in malformed C++ syntax (specifically in `parseBinanceDepth`).
- **How:** Re-wrote the ingestor logic to properly encapsulate switch/case and exchange-specific methods.
- **Section:** Core Ingestion Engine

### 6. Missing Trade Parsing Logic
- **Problem:** The C++ core was receiving trade data but had no logic to parse it, leading to "dropped events."
- **Fix:** Implemented SIMDJSON-based parsing for Binance trade events.
- **Why:** We initially focused on the Orderbook (Depth), but Trades (Ticker) were also being injected, causing buffer overflows.
- **How:** Added `parseBinanceTrade` to `ingestor.hpp` with proper `is_bid` (buyer/seller) logic.
- **Section:** Engine Logic

---

## 🚀 Performance & UI Optimization

### 7. Hyperliquid Snapshot Lag
- **Problem:** Hyperliquid's full depth snapshots were triggering every second, overwhelming the JavaScript event loop.
- **Fix:** Implemented a 1Hz throttle for the Node.js `initSnapshot` fallback.
- **Why:** Managing a full tree of 200+ levels in JS consumes high CPU; C++ should handle the raw stream instead.
- **How:** Modified `hyperliquid.ts` to check `lastSnapshotTime` before processing updates.
- **Section:** Adapter Performance

### 8. V8 Ingestion Bottleneck (The "Skip JS" Fix)
- **Problem:** System CPU was stuck at 100% because Node.js was parsing every WS message *before* sending it to C++.
- **Fix:** Implemented a "JS Parsing Bypass" in all adapters.
- **Why:** `JSON.parse()` in the hot-path is the primary source of lag. The C++ bridge now takes the raw string directly.
- **How:** Modified `ws.on('message')` in all adapters to `return` immediately if the `rawCallback` is provided.
- **Section:** High-Frequency Data Path

### 9. Frontend State "Strain"
- **Problem:** Memory usage in Chrome would climb over time until the UI became unresponsive.
- **Fix:** Aggressive state capping in `marketStore.ts`.
- **Why:** Storing 1,500+ candles and thousands of old trades in the browser's reactive state causes render lag.
- **How:** 
  1. Capped candles at 1,000 bars.
  2. Capped trades at 40 items.
  3. Added `try/catch` to `localStorage` to prevent quota errors.
- **Section:** Frontend Resilience

---

## 🎨 UI & Layout

### 10. Component Overlap (Orderbook vs QuantPanel)
- **Problem:** The Orderbook UI component was covering the QuantPanel on smaller screens.
- **Fix:** Adjusted Flexbox distributions and Z-index in the right-hand panel.
- **Why:** Responsive design breakpoints were not correctly handling the addition of the new high-performance modules.
- **How:** Refactored `App.tsx` grid layout to ensure explicit heights/widths for each side panel.
- **Section:** UX / Layout

### 11. Timeframe Selection Failure
- **Problem:** Changing timeframes on the chart Toolbar had no effect.
- **Fix:** Connected the Toolbar to the global `marketStore` timeframe state.
- **Why:** The Toolbar was using local state instead of the shared store, so the WebSocket hook never received the update.
- **How:** Replaced `useState` with `useMarketStore((s) => s.timeframe)` in `Toolbar.tsx`.
- **Section:** UX / Chart Integration
