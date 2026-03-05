# TERMINUS — Codebase Manifest
> Read this file at the start of every session before touching any source file.
> Last updated: 2026-03-05

---

## 1. What This App Is

A real-time crypto trading terminal. It connects to multiple exchanges via WebSocket,
renders live candlestick charts with overlays, shows orderbook depth, liquidation clusters,
quant analytics (bell curve / sigma distribution), options GEX, ICT overlays, and includes
a backtester. Think Bloomberg Terminal, but for crypto derivatives.

**Dev URLs**
- Frontend: http://localhost:5173
- Backend WS: ws://localhost:3000
- Backend HTTP: http://localhost:3000/api

**Start commands**
```
# Backend (from packages/server)
start.bat   ← Windows only, does NOT use watch mode — must restart manually after changes

# Frontend (from packages/web)
npm run dev
```

---

## 2. Monorepo Structure

```
orderbook_liquidation-main/
├── packages/
│   ├── web/                          ← React frontend (Vite + TypeScript)
│   │   └── src/
│   │       ├── App.tsx               ← Root layout. God file (339 lines). Contains:
│   │       │                           - view switcher (chart / backtest / exchange)
│   │       │                           - right sidebar with tabs (macro | options | analytics)
│   │       │                           - resizer logic
│   │       │                           - loading state management
│   │       │
│   │       ├── main.tsx              ← React entry point, mounts <App />
│   │       ├── index.css             ← ALL CSS variables (design tokens). Only CSS file.
│   │       ├── vite-env.d.ts
│   │       │
│   │       ├── stores/               ← Zustand state (3 main stores)
│   │       │   ├── candleStore.ts       ← candles, symbol, timeframe, HTF candles, CVD
│   │       │   ├── marketDataStore.ts   ← orderbook, liquidations, trades, quant, replay
│   │       │   ├── settingsStore.ts     ← UI prefs, panel widths, currentView
│   │       │   ├── chartDataStore.ts    ← chart-specific derived data
│   │       │   └── usePerfStore.ts      ← performance metrics (FPS, render time)
│   │       │
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts      ← SINGLETON. All WS logic lives here. 420 lines.
│   │       │   │                          Dispatches every incoming message to correct store.
│   │       │   │                          One WS connection shared by all components.
│   │       │   ├── useLayoutResizer.ts  ← drag-resize for right panel width + orderbook height
│   │       │   ├── useKeyboardShortcuts.ts ← keyboard nav (extracted from App.tsx)
│   │       │   ├── useAppEvents.ts      ← window event listeners (extracted from App.tsx)
│   │       │   ├── useDraggable.ts      ← draggable floating panel utility
│   │       │   └── useStrain.ts         ← performance strain detection
│   │       │
│   │       ├── engines/
│   │       │   ├── liqCluster.ts        ← SINGLETON ENGINE. Groups liq events into price
│   │       │   │                          clusters. State persists across component remounts.
│   │       │   │                          Export: liqClusterEngine (instance), LiqEvent, LiqCluster
│   │       │   ├── data_processor.worker.ts ← Web Worker. Parses Binance 300KB/s ticker
│   │       │   │                               payload off main thread. Uses Transferable ArrayBuffer.
│   │       │   └── websocketWorker.ts   ← Worker bootstrap
│   │       │
│   │       ├── lib/
│   │       │   ├── backtester.ts        ← Full backtest engine. Runs in browser.
│   │       │   │                          Supports: SMA/EMA/RSI/MACD/ICT/VRVP conditions,
│   │       │   │                          stop loss, take profit, fees, slippage, drawdown.
│   │       │   ├── htfBias.ts           ← Computes HTF bias from candles (SMA20/50/EMA200, RSI)
│   │       │   ├── strategyBuilder.ts   ← Strategy DSL parser
│   │       │   ├── tradeImporter.ts     ← Import trades from CSV / exchange exports
│   │       │   └── vrvp.ts              ← Volume Range Visible Profile computation
│   │       │
│   │       ├── types/
│   │       │   └── index.ts             ← SINGLE SOURCE OF TRUTH for all shared types.
│   │       │                              Rule: if two files need the same type, it lives here.
│   │       │                              Contains: CandleData, TradeData, OrderbookData,
│   │       │                              LiquidationHeatmapData, OptionsAnalyticsData,
│   │       │                              FVG, OrderBlock, ConfirmedSweep, HTFBias,
│   │       │                              Alert, VWAFDataStore, ConfluenceZone,
│   │       │                              Drawing types, IndicatorKey enum
│   │       │
│   │       └── components/
│   │           ├── chart/
│   │           │   ├── Chart.tsx            ← lightweight-charts v4 wrapper. Mounts chart,
│   │           │   │                          manages series refs, renders all overlays.
│   │           │   ├── Toolbar.tsx          ← Indicator toggles + drawing tool selector
│   │           │   ├── HTFBiasMonitor.tsx   ← HTF bias display (4H/1D/1W direction)
│   │           │   ├── SettingsPopover.tsx  ← Chart settings dropdown
│   │           │   ├── hooks/
│   │           │   │   ├── useChartSeries.ts   ← manages candle/volume/line series refs
│   │           │   │   └── useDrawings.ts      ← drawing tool state and hit testing
│   │           │   └── overlays/
│   │           │       ├── index.ts            ← Auto-registers all overlay plugins
│   │           │       ├── overlayRegistry.ts  ← Registry pattern: add overlay = 1 file + 1 line
│   │           │       ├── ictOverlay.ts       ← FVG, OrderBlock, Sweep overlays
│   │           │       ├── liquidityOverlay.ts ← Liq cluster canvas overlay
│   │           │       ├── sessionOverlay.ts   ← Session boxes (NY/London/Asia)
│   │           │       └── volumeProfileOverlay.ts ← VRVP canvas overlay
│   │           │
│   │           ├── exchange/
│   │           │   ├── ExchangePage.tsx     ← Binance/Bybit/etc live order flow view.
│   │           │   │                          Depth curve chart, trade tape, stats.
│   │           │   ├── Orderbook.tsx        ← Real-time L2 orderbook. Bid/ask walls.
│   │           │   ├── LiquidationPanel.tsx ← Liq heatmap bars + event count + total USD.
│   │           │   │                          BUG: has conditional hook (useMemo after early return).
│   │           │   ├── QuantPanel.tsx       ← Bell curve canvas, quantiles table, correlations.
│   │           │   │                          BUG: sigmaGrid nullable crashes bell curve render.
│   │           │   ├── QuantSummary.tsx     ← Slim quant card (regime icon, bias, drift, vol).
│   │           │   │                          STATUS: built but NOT YET wired into App.tsx.
│   │           │   ├── OptionsPanel.tsx     ← GEX by strike, max pain, PCR, regime.
│   │           │   ├── VWAFPanel.tsx        ← Volume-weighted avg funding rate display.
│   │           │   ├── ConfluencePanel.tsx  ← Confluence zones from multiple signals.
│   │           │   ├── ReplayPanel.tsx      ← Replay controls (start/pause/stop/speed).
│   │           │   │                          NOTE: This is the sidebar version.
│   │           │   └── FloatingBacktestPanel.tsx ← Floating panel triggered by nav button.
│   │           │
│   │           ├── backtest/
│   │           │   ├── BacktestPage.tsx     ← Full-page backtest view
│   │           │   ├── BacktestPanel.tsx    ← Results display (P&L, trades table)
│   │           │   ├── EquityChart.tsx      ← Equity curve (lightweight-charts)
│   │           │   ├── DrawdownChart.tsx    ← Drawdown visualization
│   │           │   └── MonthlyHeatmap.tsx   ← Monthly returns heatmap
│   │           │
│   │           └── shared/
│   │               ├── TerminusNav.tsx      ← Top navigation. 1000+ lines. Contains:
│   │               │                          - Market switcher (handleSelectMarket)
│   │               │                          - Ticker tape (second WS to Binance fstream)
│   │               │                          - Exchange tabs (Binance/Bybit/OKX/etc)
│   │               │                          - Timeframe selector
│   │               │                          - All dropdown menus
│   │               ├── UI.tsx               ← Shared component primitives:
│   │               │                          PanelSection, StatCard, Badge, Button,
│   │               │                          Toggle, Input
│   │               ├── ErrorBoundary.tsx    ← Wraps every major component. Catches crashes
│   │               │                          and shows fallback instead of white screen.
│   │               ├── Toast.tsx            ← Toast notification system + NotifMutedBadge
│   │               ├── AlertManager.tsx     ← Alert creation and management panel
│   │               └── PerfStats.tsx        ← FPS / render time overlay
│   │
│   └── server/
│       └── src/
│           └── index.ts              ← Entire backend in one file (~450 lines).
│                                       WebSocket server, Binance adapter, Redis,
│                                       symbol routing, quant engine, replay engine.
│
├── CODEBASE.md                       ← THIS FILE
└── DECISIONS.md                      ← Why things are the way they are
```

---

## 3. State Architecture

### Three Zustand Stores — Know Which One to Use

```
candleStore       — anything related to price history and time
  symbol          ← currently selected market (e.g. 'BTCUSDT')
  timeframe       ← selected interval ('1m','5m','15m','1h','4h','1d')
  candles[]       ← primary OHLCV array, max 1500, deduplicated by Map
  aggregatedCandles[] ← multi-exchange VWAP candles
  showAggregated  ← toggle between primary and aggregated
  htfCandles      ← Record<tf, CandleData[]> for '4h','1d','1w'
  htfBias         ← Record<tf, HTFBias> computed server-side
  multiTfCvd      ← Record<tf, {time,value}[]> streaming CVD

marketDataStore   — anything that updates at websocket frequency
  connected       ← WS connection state
  lastPrice       ← current price, updates every tick
  priceDirection  ← 'bullish' | 'bearish' | 'neutral' (vs prev tick)
  orderbook       ← L2 bid/ask with wall detection
  deepOrderbook   ← extended depth for depth curve chart
  liquidations    ← LiquidationHeatmapData (heatmap array + totals)
  liqClusters[]  ← processed clusters from liqClusterEngine
  trades[]        ← last 50 trades (tape)
  options         ← OptionsAnalyticsData (GEX, max pain, PCR)
  optionTrades[]  ← last 30 large option trades
  fundingRates[]  ← streaming funding rate history
  openInterest[]  ← streaming OI history, max 500 points
  vwaf            ← VWAFDataStore (volume-weighted avg funding)
  confluenceZones[]
  ictData         ← { fvgs, orderBlocks, sweeps, swingHighs, swingLows }
  confirmedSweeps[]
  activeAlerts[]
  quantSnapshot   ← full quant payload (sigmaGrid, quantiles, macroBreakdown, meta)
  isReplayMode    ← true when replay is active
  replayTimestamp ← current replay position
  replayConfig    ← { startTime, endTime, speed }
  replayPaused
  send()          ← registered by useWebSocket, call to send WS message

settingsStore     — UI preferences, persisted to localStorage
  currentView     ← 'chart' | 'backtest' | 'exchange' | 'screener'
  exchangeView    ← 'binance' | 'bybit' | 'okx' | 'hyperliquid' | 'mexc' | 'bitget' | 'gateio'
  showOrderbook   ← toggles orderbook panel
  rightPanelWidth ← drag-resizable, default 320px
  orderbookHeight ← drag-resizable, default 320px
  theme           ← 'Dark' | 'Light'
  chartLayout     ← 'Advanced' | 'Simple'
  notificationLevel ← 'all' | 'critical_only' | 'off'
```

### Store Selection Rule
```
"Does this data come from a WebSocket message?"  → marketDataStore
"Does this relate to candles, symbol, timeframe?" → candleStore
"Does this affect how the UI looks/behaves?"      → settingsStore
```

---

## 4. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND (server/index.ts)               │
│                                                                 │
│  Binance WS ──┐                                                 │
│  Bybit WS ────┼──► symbol routing ──► Redis cache              │
│  OKX WS ──────┘         │                                       │
│                          ▼                                      │
│               clientHub.broadcast()  ← sends to ALL clients    │
│               clientHub.sendToClient() ← targeted send         │
└─────────────────────────────────────────────────────────────────┘
                          │ WebSocket (ws://localhost:3000)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    useWebSocket.ts (SINGLETON HOOK)             │
│                                                                 │
│  Web Worker (data_processor.worker.ts)                         │
│    ← parses Binance 300KB/s ticker off main thread             │
│    ← uses Transferable ArrayBuffer, 15 FPS flush throttle      │
│                                                                 │
│  switch(msg.type):                                              │
│    candles            → candleStore.setCandles()               │
│    candle_update      → candleStore.addCandle / updateLast      │
│    orderbook          → marketDataStore.setOrderbook()         │
│    orderbook.deep     → marketDataStore.setDeepOrderbook()     │
│    liquidations       → marketDataStore.addLiquidation()       │
│    liquidations.heatmap → marketDataStore.setLiquidations()    │
│    trades             → marketDataStore.addTrade()             │
│    options.analytics  → marketDataStore.setOptions()           │
│    options.large_trade → marketDataStore.addOptionTrade()      │
│    funding_rate       → marketDataStore.setFundingRates()      │
│    open_interest      → marketDataStore.setOpenInterest()      │
│    vwaf               → marketDataStore.setVwaf()              │
│    confluence         → marketDataStore.setConfluenceZones()   │
│    quant.analytics    → marketDataStore.setQuantSnapshot()     │
│    ict.data           → marketDataStore.setIctData()           │
│    ict.sweep_confirmed → marketDataStore.setConfirmedSweeps()  │
│    symbol_changed     → clears relevant stores, updates UI     │
│    alerts             → marketDataStore.addAlert()             │
│    replay             → marketDataStore replay setters         │
└─────────────────────────────────────────────────────────────────┘
                          │ Zustand subscriptions
                          ▼
                    React Components
                 (read stores, never fetch directly)
```

### HTTP Endpoints (frontend → backend)
```
GET /api/ohlcv?symbol=BTCUSDT&interval=1h&limit=5000
GET /api/ohlcv/aggregated?symbol=BTCUSDT&interval=1h&limit=5000
```
Used only on initial load and timeframe/symbol change. All live updates come via WS.

---

## 5. WebSocket Message Reference

### Client → Server (Actions)
```typescript
send({ action: 'switch_symbol', symbol: 'ETHUSDT' })
  // Rate limited: 5 second cooldown
  // IMPORTANT: globalSymbol on server is shared across ALL clients
  // One client switching symbol affects every connected client

send({ action: 'change_timeframe', timeframe: '4h' })

send({ action: 'start_replay', startTime: 1700000000, endTime: 1700100000, speed: 1 })
send({ action: 'pause_replay' })    // BUG: FloatingReplayPanel pause onClick is undefined
send({ action: 'stop_replay' })
send({ action: 'set_replay_speed', speed: 2 })
```

### Server → Client (Message Types)
```
candles                    → initial candle load
candle_update              → tick update to last candle
orderbook / orderbook.aggregated / orderbook.deep
liquidations               → single liq event (LiqEvent shape)
liquidations.heatmap       → full heatmap snapshot
trades                     → trade tape events
options.analytics          → GEX, max pain, PCR
options.large_trade        → single large option trade
funding_rate               → single funding rate data point
open_interest              → single OI data point
vwaf                       → volume-weighted avg funding rate
confluence                 → confluence zone array
quant.analytics            → { meta, sigmaGrid, quantiles, macroBreakdown }
ict.data                   → { fvgs, orderBlocks, sweeps, swingHighs, swingLows }
ict.sweep_confirmed        → single confirmed sweep event
symbol_changed             → server confirmed symbol switch
alerts                     → alert events
replay                     → replay state updates
```

### quantSnapshot Shape (critical — several components depend on this)
```typescript
quantSnapshot = {
  meta: {
    adjustedDrift: number,    // % expected 1-day drift (Kalman-smoothed)
    stepVolatility: number,   // % 1-sigma daily vol
    horizon: number,          // days (usually 1)
    symbol: string,
  },
  sigmaGrid: [               // bell curve data points
    { sigma: -3, price: number, probability: number, pctMove: number },
    { sigma: -2, ... },
    // ... through +3 sigma
  ],
  quantiles: {
    p5:  { price: number, pctMove: number },
    p25: { price: number, pctMove: number },
    p50: { price: number, pctMove: number },
    p75: { price: number, pctMove: number },
    p95: { price: number, pctMove: number },
  },
  macroBreakdown: [
    { ticker: string, correlation: number, zScore: number },
    // DXY, SPX, GOLD, VIX, US10Y
  ]
}
```

---

## 6. CSS Design System

**One file:** `packages/web/src/index.css`
**No Tailwind. No CSS modules.** Everything uses CSS custom properties.

### Core Variables (use these in all new components)
```css
/* Backgrounds — darkest to lightest */
--bg-base:     #07090d   /* page background */
--bg-surface:  #0d1117   /* panel background */
--bg-raised:   #131920   /* card / stat card */
--bg-overlay:  #1a2230   /* hover states, table rows */

/* Brand colors */
--accent:      #00ffc8   /* teal — primary interactive */
--positive:    #00c87a   /* green — bullish, profit */
--negative:    #ff3b5c   /* red — bearish, loss */
--warning:     #f0c040   /* yellow — caution, volatility */
--neutral:     #5a6070   /* gray — flat/ranging */

/* Text hierarchy */
--text-primary:    #dde6f0   /* main content */
--text-secondary:  #7a8898   /* labels, secondary */
--text-muted:      #3a4455   /* disabled, placeholder */
--text-accent:     #00ffc8   /* highlighted text */

/* Borders */
--border-strong:  rgba(255,255,255,0.11)
--border-medium:  rgba(255,255,255,0.07)
--border-subtle:  rgba(255,255,255,0.03)

/* Typography */
--font:     'JetBrains Mono', monospace   /* only font used */
--text-xs:  9px
--text-sm:  10px
--text-md:  12px
--text-lg:  14px
--text-xl:  18px

/* Sizing */
--h-topnav:   44px
--h-ticker:   30px
--h-toolbar:  38px
--h-phead:    34px   /* panel section header */
--h-input:    30px
--r-sm:  3px   /* border-radius */
--r-md:  5px
--r-lg:  8px
--r-pill: 100px

/* LEGACY ALIASES — exist for backward compat, prefer the canonical names above */
--color-bg-base → --bg-base
--color-positive → --positive
--font-mono → --font
/* etc. Both work. New code should use the canonical short form. */
```

### Known CSS Bugs
```
--space-1 through --space-4 are NOT defined anywhere.
--radius-sm is NOT defined anywhere.
Components that use them (LiquidationPanel, VWAFPanel, ConfluencePanel,
FloatingBacktestPanel) have 0px spacing/radius as a result.

FIX: Add to index.css :root block:
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --radius-sm: var(--r-sm);
```

---

## 7. Component Patterns — Rules to Follow

### Rule 1: Hooks Always Before Any Return
```typescript
// ✅ CORRECT
export function MyPanel() {
    const data = useMarketDataStore(s => s.liquidations);
    const computed = useMemo(() => {
        if (!data) return [];          // null guard INSIDE memo
        return data.heatmap.slice(0, 3);
    }, [data]);

    if (!data) return <PanelSkeleton label="MY PANEL" />;  // early return AFTER hooks

    return <div>{computed.map(...)}</div>;
}

// ❌ BROKEN — causes "Rendered more hooks than during previous render"
export function MyPanel() {
    const data = useMarketDataStore(s => s.liquidations);
    if (!data) return <div>waiting...</div>;  // early return BEFORE useMemo
    const computed = useMemo(() => ..., [data]);  // hook after early return = crash
}
```

### Rule 2: Safe Data Access (use utils/safe.ts once created)
```typescript
// Never trust incoming data shapes from WebSocket
const items = Array.isArray(data?.heatmap) ? data.heatmap : [];
const total = typeof data?.total_usd === 'number' ? data.total_usd : 0;

// Never use raw .toFixed() — always check for null/NaN first
const price = (v: number | null | undefined) => {
    if (v == null || isNaN(v)) return '---';
    if (v >= 10000) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (v >= 1)     return `$${v.toFixed(2)}`;
    return `$${v.toFixed(5)}`;   // sub-dollar assets (DOGE, XRP)
};
```

### Rule 3: Loading States Must Have Height
```typescript
// ❌ Collapses to 0px, panel disappears, looks broken
if (!data) return null;
if (!data) return <div>loading...</div>;  // no height, invisible

// ✅ Visible, consistent across app
if (!data) return (
    <div style={{ padding: '16px', minHeight: '80px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '2px' }}>
        AWAITING DATA...
    </div>
);
```

### Rule 4: New Overlay = One File + One Line
```typescript
// To add a new chart overlay:
// 1. Create packages/web/src/components/chart/overlays/myOverlay.ts
// 2. Add one line to overlays/index.ts:
import './myOverlay';
// That's it. The registry handles the rest.
```

### Rule 5: Floating Panels Follow FloatingBacktestPanel Pattern
```typescript
// Trigger: window.dispatchEvent(new CustomEvent('TERMINUS_SHOW_X'))
// App.tsx listens in useAppEvents.ts → sets showXPanel state
// Panel renders as absolute/fixed overlay with useDraggable hook
// Close: onClose prop → sets showXPanel(false)
```

---

## 8. Known Bugs (Active)

These are confirmed bugs that will generate failures. Check this list before
assuming new code caused a problem.

### CRITICAL
```
[BUG-1] Symbol whitelist mismatch
  File: packages/server/src/index.ts:293
  Code: const SYMBOL_WHITELIST = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','LINKUSDT','ADAUSDT']
  Nav shows: BNBUSDT, XAUUSDT, DOGEUSDT, APTUSDT, XAGUSDT, POWERUSDT (all silently rejected)
  Effect: Clicking 6 of the nav symbols does nothing, no error shown
  Fix: Add missing symbols to whitelist, OR send symbol_rejected WS message to client

[BUG-2] Conditional hook in LiquidationPanel
  File: packages/web/src/components/exchange/LiquidationPanel.tsx:~130
  Cause: useMemo called after early return on line ~10
  Effect: "Rendered more hooks than during previous render" crash
  Fix: Move ALL hooks above the first return statement
```

### HIGH
```
[BUG-3] Stale state after symbol switch
  File: packages/web/src/components/shared/TerminusNav.tsx (handleSelectMarket)
  Cleared on switch: candles, orderbook, options, liquidations, vwaf, confluenceZones (5 stores)
  NOT cleared: trades, deepOrderbook, quantSnapshot, ictData, confirmedSweeps, openInterest, fundingRates
  Effect: Trade tape, quant bell curve, ICT overlays show previous symbol's data after switch
  Fix: Add 7 more setters to handleSelectMarket clear block

[BUG-4] Replay PAUSE button is dead
  File: packages/web/src/components/exchange/ReplayPanel.tsx (pause button)
  Cause: onClick handler is undefined
  Effect: Pause button renders but does nothing when clicked
  Fix: Add onClick={() => send({ action: 'pause_replay' })}
```

### MEDIUM
```
[BUG-5] Price formatting breaks for sub-$1 assets
  Files: Orderbook.tsx, ExchangePage.tsx (multiple locations)
  Code: price.toFixed(1) — hardcoded for BTC scale
  Effect: DOGE ($0.15) shows '0.2', XRP ($0.58) shows '0.6'
  Fix: Replace with formatPrice() utility that checks magnitude

[BUG-6] QuantPanel bell curve crashes on undefined sigmaGrid
  File: packages/web/src/components/exchange/QuantPanel.tsx
  Cause: quantSnapshot arrives but sigmaGrid is undefined (Python timing issue)
  Effect: Bell curve canvas render throws, caught by ErrorBoundary
  Fix: Add null guard before BellCurveChart render

[BUG-7] Loading spinner never clears if server returns 0 candles
  File: packages/web/src/App.tsx:113,135
  Cause: setLoading(false) only fires when candles.length > 0
  Effect: 8-second loading screen for any symbol with empty Redis cache
  Fix: Also clear loading on symbol_changed WS message
```

### DISPLAY
```
[BUG-8] --space-* and --radius-sm CSS variables undefined
  Resolves to 0px → panels have no internal padding/spacing
  Fix: Add to index.css :root (see Section 6)

[BUG-9] DepthCurveChart ask side has no gradient fill
  File: ExchangePage.tsx
  Cause: SVG defs has bidGrad + maskGrad but NOT askGrad
  Effect: Ask side of depth chart shows outline only, no fill

[BUG-10] TerminusNav ticker shows hardcoded stale prices on load
  File: TerminusNav.tsx (defaultMarkets object)
  Values: BTC='67,728.5', ETH='3,482.1', SOL='182.44' (from whenever written)
  Effect: Wrong prices shown until Binance fstream connects
```

---

## 9. Architecture Decisions

### Why single WebSocket connection?
Multiple components subscribing independently caused duplicate Binance connections
and race conditions on symbol switch. Centralized in useWebSocket.ts singleton.
All components read from Zustand stores only.

### Why Web Worker for ticker parsing?
The Binance fstream `!ticker@arr` pushes 300+ symbols every second (~300KB/s).
Parsing on main thread caused chart stuttering at 60fps. Worker uses Transferable
ArrayBuffer to pass parsed data to main thread with zero-copy.

### Why liqClusterEngine is a singleton (not in store)?
Cluster state needs to persist across component remounts and tab switches.
The store holds only the rendered snapshot. The engine holds full cluster history
and applies age-based fade logic. Putting it in the store would mean losing
cluster history on every store reset.

### Why candleStore is separate from marketDataStore?
Candles update at 1-second intervals and trigger lightweight-charts redraws.
Keeping them separate prevents orderbook, liquidation, and trade updates (which
come at 100ms intervals) from causing unnecessary chart re-renders via
shared store subscriptions.

### Why globalSymbol on server is a single shared variable?
Current architecture is single-user. One server instance serves one active symbol.
All connected clients see the same symbol's data. This is a known scalability
limit — fixing it requires per-client symbol routing and symbol-keyed stream
engines. Tracked but not yet addressed.

### Why backtester runs in browser (not server)?
Avoids server compute load and allows instant parameter iteration without
round-trip latency. The backtester lib is pure computation with no I/O.
Strategy builder compiles condition strings to JS functions client-side.

### Why TerminusNav opens a second WebSocket to Binance directly?
The nav ticker tape needs all ~300 perpetual futures symbols for price display.
Routing this through the app's backend WS would require the server to subscribe
to all symbols simultaneously. The direct browser connection was faster to
implement. Known issue: doubles browser WS connection count.

---

## 10. Planned Work (Not Yet Started)

### Architecture Revamp
```
TerminalSummaryPanel   — replace sidebar tabs with single signal-grade summary
FloatingQuantPanel     — move QuantPanel out of sidebar to floating panel
FloatingLiquidationPanel — move LiquidationPanel to floating panel
FloatingOptionsPanel   — move OptionsPanel to floating panel
All triggered from TerminusNav Tools/Analytics dropdown (like FloatingBacktestPanel)
```

### Grade Algorithm (approved, not implemented)
```
Combine: quantSnapshot.meta.adjustedDrift + liq long/short ratio
         + options GEX sign + htfBias direction
→ weighted bull/bear score → confidence percentage → STRONG/MODERATE/WEAK
```

### Asset Capability Map (planned)
```typescript
// Drives which floating panels enable/disable per asset class
assetCapabilities = {
  crypto_perp: { options: true,  liq: true,  quant: true,  funding: true  },
  crypto_spot:  { options: false, liq: false, quant: true,  funding: false },
  fx_pair:      { options: false, liq: false, quant: true,  funding: false },
  equity:       { options: true,  liq: false, quant: true,  funding: false },
}
```

### utils/safe.ts (approved pattern, not yet created)
```typescript
// fmt.price(v)  — dynamic decimals based on magnitude
// fmt.money(v)  — $1.2M / $450K / $230
// fmt.pct(v)    — +1.23% with sign
// safe.arr(v)   — guaranteed array, never null
// safe.num(v)   — guaranteed number with fallback
```

### significantLiquidations store field
```typescript
// Track whale liquidations (> $10K) in marketDataStore
// Feed into LiquidationPanel whale tape
// Throttle display to 10 events/sec max
```

### Quant Engine C++ Port (planned, not started)
```
Replace Python macro analytics subprocess with C++ via N-API
Current: 800ms (spawn Python → download → compute → serialize)
Target:  ~5ms (Redis → C++ math → broadcast)
Files planned: quant_math.hpp, N-API binding, updated quant.ts engine
```

---

## 11. Performance Notes

```
Lighthouse score (dev build, with extensions): 51
Realistic production score (incognito, built): 65-75
Target ceiling for a real-time trading terminal: ~75 (Bloomberg scores ~60)

Biggest wins already applied:
  - Lazy loading for BacktestPage, ExchangePage, all sidebar panels
  - Manual chunk splitting in vite.config.ts
  - Web Worker for ticker parsing
  - candleStore Map-based deduplication (prevents duplicate timestamps)

Not worth optimizing:
  - JS execution time (lightweight-charts canvas init is unavoidable)
  - Non-composited animations (spinner, price flash — low impact)
  - Back/forward cache (trading terminals legitimately can't cache state)
```

---

## 12. Quick Reference — Where Is X?

| What | File |
|---|---|
| Add a new WS message type (server sends it) | `server/src/index.ts` + `useWebSocket.ts` switch |
| Add a new Zustand store field | `marketDataStore.ts` or `candleStore.ts` |
| Add a new chart indicator | New file in `overlays/` + one import in `overlays/index.ts` |
| Add a new nav menu item | `TerminusNav.tsx` NAV_ITEMS array |
| Change any color | `index.css` :root block |
| Add a new floating panel | Follow `FloatingBacktestPanel.tsx` pattern |
| Change symbol whitelist | `server/src/index.ts:293` SYMBOL_WHITELIST |
| Add a new type | `types/index.ts` (never in a component file) |
| Keyboard shortcuts | `hooks/useKeyboardShortcuts.ts` |
| Window event listeners | `hooks/useAppEvents.ts` |
| Chart drawing tools | `components/chart/hooks/useDrawings.ts` |
