# TERMINUS — Architecture Decisions Log

> This file records WHY things are the way they are.
> Before refactoring something that "looks wrong", check here first.
> If you make a structural change, add an entry explaining why.

---

## [2025-Q4] Single WebSocket connection via useWebSocket.ts singleton

**Decision:** All WebSocket communication flows through one hook, mounted once in App.tsx.
Components never open their own connections.

**Why:** Early prototype had components subscribing independently. This caused:
- Duplicate Binance stream connections (rate-limited after 3 connections)
- Race conditions when two components called `switch_symbol` concurrently
- Impossible to reason about message ordering

**Tradeoff:** useWebSocket.ts has grown to 420 lines and is a coupling bottleneck.
Adding new message types requires editing this file. Known issue, not yet refactored.

---

## [2025-Q4] Web Worker for Binance ticker parsing

**Decision:** The `!ticker@arr` fstream subscription (all perpetual futures tickers)
is parsed in `data_processor.worker.ts`, not on the main thread.

**Why:** Binance pushes ~300 symbols every 1 second, ~300KB per message.
JSON.parse() of this payload on the main thread blocked the chart render loop,
causing visible stutter at 60fps candlestick updates.

**Implementation:** Uses `Transferable` objects (ArrayBuffer) to pass parsed data
from worker to main thread with zero-copy semantics.

---

## [2025-Q4] candleStore separated from marketDataStore

**Decision:** Candle data lives in its own Zustand store, not in marketDataStore.

**Why:** Candles update at 1-second intervals and every update triggers a
lightweight-charts redraw. marketDataStore updates at 100ms+ intervals
(orderbook, trades, liquidations). If they shared a store, every orderbook
tick would trigger a chart re-render via Zustand subscription, regardless
of whether candle data changed.

**Rule:** Never mix high-frequency render-triggering state with high-frequency
non-render state in the same store.

---

## [2025-Q4] liqClusterEngine as module singleton, not in Zustand

**Decision:** `liqClusterEngine` is exported as a module-level singleton instance,
not stored inside Zustand.

**Why:** The cluster engine needs to maintain full event history to correctly
compute cluster merging and age-based fading. If it lived in Zustand, any
`set()` call would replace the entire engine object, losing cluster state.
The store holds only the rendered snapshot (array of visible clusters), while
the engine holds the full history.

**Pattern:**
```
Engine (module singleton) → processes raw events, maintains history
Store (Zustand)           → holds snapshot for component rendering
```

---

## [2025-Q4] Backtester runs in browser, not server

**Decision:** `lib/backtester.ts` runs entirely client-side.

**Why:**
- Avoids server load for compute-intensive parameter sweeps
- No round-trip latency — instant results as user adjusts parameters
- The backtester is pure computation: no I/O, no network, no database access
- Candle data is already in the browser (candleStore)

**Tradeoff:** Large backtests (1500 candles × complex strategy) can block
the main thread for ~200ms. Acceptable for current use case.
Future fix: move to a Web Worker if blocking becomes noticeable.

---

## [2025-Q4] globalSymbol as single server-side variable

**Decision:** The backend has one `globalSymbol` variable shared across all
connected clients. One client switching symbols affects all clients.

**Why:** Implemented for single-user use case. Per-client symbol routing requires:
- Symbol-keyed stream engine instances (multiple Binance connections)
- Client-to-symbol routing table in the hub
- Symbol-specific Redis key namespacing (already partially done: `candles:${symbol}:${tf}`)

**Known limitation:** Cannot support multiple concurrent users with different
symbols. A second user connecting and switching symbols will interrupt the
first user's feed.

**Planned fix:** Per-client symbol routing, symbol-keyed engines, remove globalSymbol.
Not yet implemented.

---

## [2025-Q4] TerminusNav opens second WebSocket to Binance directly

**Decision:** The ticker tape in TerminusNav connects directly to
`wss://fstream.binance.com/ws/!ticker@arr` from the browser.

**Why:** The ticker needs real-time prices for all ~300 perpetual futures symbols.
Routing this through the backend would require the server to maintain a subscription
to all symbols simultaneously, which conflicts with the single-symbol architecture.
Direct browser connection was faster to implement and doesn't require backend changes.

**Cost:** Browser holds two WebSocket connections simultaneously (app server + Binance).
Binance fstream pushes ~300KB/s to the browser regardless of how many symbols are displayed.

**Better approach (planned):** Route through backend WS, filter to only the symbols
visible in the ticker tape, reduce bandwidth by ~95%.

---

## [2025-Q4] ErrorBoundary wrapping every major component

**Decision:** Every panel, chart component, and page is wrapped in `<ErrorBoundary>`.

**Why:** Trading terminal must never white-screen. A crash in the liquidation panel
should not kill the chart. ErrorBoundary isolates failures to their component tree
and shows a fallback instead of propagating the error upward.

**Pattern:** `<ErrorBoundary name="ComponentName"><Component /></ErrorBoundary>`
The `name` prop appears in console errors for fast debugging.

---

## [2026-01] Lazy loading for heavy components

**Decision:** BacktestPage, ExchangePage, all sidebar panels use `React.lazy()`.

**Why:** Lighthouse audit showed initial bundle was downloading and parsing
components the user had never opened. Lazy loading moves them into separate
chunks that only load on first navigation to that view.

**Implementation:** `vite.config.ts` has manual chunk splitting to prevent
random chunk boundaries — vendor-react, vendor-charts, chunk-backtester
are named chunks so CDN caching works correctly.

---

## [2026-01] Overlay registry pattern

**Decision:** Chart overlays use a registry: each overlay is a self-contained file
that registers itself when imported.

**Why:** Early chart code had a 200-line switch statement in Chart.tsx that
manually handled each overlay. Adding a new overlay required editing Chart.tsx.
The registry pattern means adding an overlay = create one file + add one import
to `overlays/index.ts`. Chart.tsx doesn't change.

---

## [2026-02] HTF candles persisted to localStorage

**Decision:** Last 50 candles per HTF timeframe are persisted to localStorage
between sessions.

**Why:** Computing RSI/SMA indicators requires seed data — you need ~50 candles
of history before indicator values stabilize. Without persistence, every page
reload showed incorrect indicator values for the first ~50 candles until
enough history loaded via WebSocket.

**Limit:** 50 candles per timeframe × 3 timeframes (4h, 1d, 1w) = ~150 candle objects.
Well within localStorage quota. Full history (up to 500 candles) is in-memory only.

---

## [2026-03] Component convention: hooks before returns

**Decision:** All hooks (useState, useEffect, useMemo, useCallback, useRef) must
appear at the top of the component function, before any conditional return.

**Why:** React's Rules of Hooks require hook call order to be identical on every
render. An early return before a hook means that hook is called on some renders
but not others, causing "Rendered more hooks than during the previous render" crash.

**Enforcement:** This has already caused one production crash (LiquidationPanel).
The pattern is now a required convention, not a preference.

**Pattern:**
```typescript
function MyComponent() {
    // ALL hooks here, unconditionally
    const data = useStore(s => s.data);
    const computed = useMemo(() => {
        if (!data) return [];  // null guard INSIDE the hook
        return process(data);
    }, [data]);

    // Early returns AFTER all hooks
    if (!data) return <Skeleton />;

    return <div>{computed}</div>;
}
```
