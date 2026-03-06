# SPEC — Terminal Enhancements & API Stabilization

**Status**: FINALIZED

## Objective
Enhance the crypto trading terminal by improving performance (Lightweight Charts), stabilizing APIs, decentralizing UI components into floating panels, and implementing new analytics features like the Grade Algorithm and Asset Capability Map.

## Requirements

### 1. Infrastructure & API
- **Charting**: Replace existing D3/Canvas charts with `tradingview/lightweight-charts` for better performance.
- **Authentication**: Re-enable and configure the Clerk plugin in the backend.
- **Backend Refactoring**: Decentralize `packages/server/src/index.ts` by splitting out routing and plugin logic.

### 2. UI Architecture Decentralization
- Follow the `FloatingBacktestPanel` pattern to create:
  - `FloatingQuantPanel`
  - `FloatingLiquidationPanel`
  - `FloatingOptionsPanel`
- Replace sidebar tabs with a single `TerminalSummaryPanel` showing signal grades.

### 3. Core Features
- **Asset Capability Map**: Define which asset classes (crypto_perp, crypto_spot, fx, equity) support which panels.
- **Grade Algorithm**: Weighted bull/bear score using drift, liq ratio, GEX sign, and HTF bias.
- **Formatting Utilities**: Implement `utils/safe.ts` (`fmt.price`, `fmt.money`, `fmt.pct`, `safe.arr`, `safe.num`).
- **Whale Tracking**: Track significant liquidations in `marketDataStore`.

### 4. Known Bugs to Address
- **BUG-1**: Symbol whitelist mismatch (add remaining symbols).
- **BUG-2**: Conditional hook crash in `LiquidationPanel`.
- **BUG-3**: Stale state across multiple stores after symbol switch.
- **BUG-4**: Replay PAUSE button `onClick` is undefined.
- **BUG-5**: Price formatting breaks for sub-$1 assets (requires `utils/safe.ts`).
- **BUG-6**: `QuantPanel` bell curve crashes on undefined `sigmaGrid`.
- **BUG-7**: Loading spinner never clears if server returns 0 candles.

## Verification
- All floating panels can be toggled via `TerminusNav` and dragged independently.
- Changing symbols updates all panel data without stale residue.
- Sub-$1 assets render prices accurately (e.g., $0.15000).
- Backend logs show successful Clerk auth and TimescaleDB connections.
